import { supabase } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

function vietnamToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function isVietnamToday(value) {
  if (!value) return false;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10)) && !raw.includes('T')) {
    return raw.slice(0, 10) === vietnamToday();
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date) === vietnamToday();
}

function friendlyRewardError(error, fallback) {
  const message = String(error?.message || error || '').replace(/^.*ERROR:\s*/i, '').trim();
  return message || fallback;
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  let userId = data?.user?.id || null;
  if (!userId) {
    const session = await supabase.auth.getSession();
    userId = session.data.session?.user?.id || null;
  }
  if (error && !userId) console.log('[rewards] getUser lỗi', error);
  if (!userId) throw new Error('Cần đăng nhập để thực hiện.');
  console.log('[rewards] user', userId);
  return userId;
}

export async function fetchRewardBoard(userId) {
  const [tasksResult, rewardsResult, progressResult, claimsResult, profileResult] = await Promise.all([
    supabase.from('tasks').select('*').eq('is_active', true).order('created_at', { ascending: true }),
    supabase.from('rewards').select('*').eq('is_active', true).order('point_cost', { ascending: true }),
    userId
      ? supabase.from('user_tasks').select('*').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
    userId
      ? supabase.from('reward_claims').select('id, reward_id, status, claim_code, created_at').eq('user_id', userId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    userId ? loadRewardProfile(userId) : Promise.resolve({ data: null }),
  ]);

  if (tasksResult.error || rewardsResult.error) {
    const message = tasksResult.error?.message || rewardsResult.error?.message || '';
    const missing = /tasks|rewards|schema cache|does not exist/i.test(message);
    return { missing, tasks: [], rewards: [], claims: [], points: 0, checkedInToday: false };
  }

  if (progressResult.error) {
    console.log('[rewards] không đọc được tiến độ nhiệm vụ', progressResult.error);
  }
  if (profileResult.error) {
    console.log('[rewards] không đọc được số xu', profileResult.error);
  }
  const progress = Object.fromEntries((progressResult.data || []).map((row) => [row.task_id, row]));
  const tasks = (tasksResult.data || []).map((row) => {
    const mine = progress[row.id];
    const target = Number(row.target_count) || 1;
    const current = Number(mine?.current_count) || 0;
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      actionType: row.action_type,
      groupKey: row.group_key || 'core',
      targetCount: target,
      rewardPoints: Number(row.reward_points) || 0,
      currentCount: Math.min(current, target),
      status: mine?.status || 'in_progress',
      updatedAt: mine?.updated_at || null,
    };
  });
  const checkedInToday = await readCheckedInToday(userId, profileResult.data, tasks);
  const rewardNames = Object.fromEntries((rewardsResult.data || []).map((row) => [row.id, row.title]));
  console.log('[rewards] bảng nhiệm vụ', { userId, points: profileResult.data?.reward_points, checkedInToday });
  return {
    missing: false,
    checkedInToday,
    points: Number(profileResult.data?.reward_points) || 0,
    wallet: Number(profileResult.data?.wallet_balance) || 0,
    streak: Number(profileResult.data?.reward_streak) || 0,
    luckySpins: Number(profileResult.data?.lucky_spins) || 0,
    mysteryBoxes: Number(profileResult.data?.mystery_boxes) || 0,
    boostCredits: Number(profileResult.data?.boost_credits) || 0,
    claims: (claimsResult.data || []).map((row) => ({
      id: row.id,
      rewardId: row.reward_id,
      title: rewardNames[row.reward_id] || 'Quà',
      status: row.status || 'pending',
      createdAt: row.created_at,
    })),
    tasks,
    rewards: (rewardsResult.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      groupKey: row.group_key || 'wallet',
      pointCost: Number(row.point_cost) || 0,
      value: Number(row.value) || 0,
      stock: Number(row.stock_quantity) || 0,
      imageUrl: row.image_url || '',
    })),
  };
}

export async function checkInReward() {
  try {
    await requireUserId();
    const result = await supabase.rpc('reward_daily_checkin');
    console.log('[rewards] điểm danh', { data: result.data, error: result.error });
    if (result.error) throw new Error(friendlyRewardError(result.error, 'Không điểm danh được.'));
    const data = result.data;
    if (data && typeof data === 'object') {
      return {
        points: Number(data.points) || 0,
        credited: data.credited !== false,
        lucky_spin: Boolean(data.lucky_spin),
        mystery_box: Boolean(data.mystery_box),
      };
    }
    return { points: Number(data) || 0, credited: null };
  } catch (error) {
    throw new Error(friendlyRewardError(error, 'Không điểm danh được.'));
  }
}

export async function claimRewardTask(taskId) {
  if (!isUuid(taskId)) throw new Error('Nhiệm vụ chưa sẵn sàng.');
  try {
    await requireUserId();
    const result = await supabase.rpc('claim_reward_task', { p_task_id: taskId });
    console.log('[rewards] nhận xu', { taskId, data: result.data, error: result.error });
    if (result.error) throw new Error(friendlyRewardError(result.error, 'Không nhận xu được.'));
    if (result.data && typeof result.data === 'object') return result.data;
    return { points: Number(result.data) || 0 };
  } catch (error) {
    throw new Error(friendlyRewardError(error, 'Không nhận xu được.'));
  }
}

export async function recordRewardAction(action) {
  const result = await supabase.rpc('reward_record_action', { p_action: action });
  if (result.error) return 0;
  return Number(result.data) || 0;
}

function readPlayResult(data) {
  if (data && typeof data === 'object') {
    return {
      prizeId: data.prize_id || null,
      prizeName: data.prize_name || 'Phần thưởng',
      prizeType: data.prize_type || 'coin',
      value: Number(data.value) || 0,
      pointsLeft: data.points_left == null ? null : Number(data.points_left),
      turnsLeft: data.turns_left == null ? null : Number(data.turns_left),
    };
  }
  const value = Number(data) || 0;
  return {
    prizeId: null,
    prizeName: value ? `${value} xu` : 'Phần thưởng',
    prizeType: 'coin',
    value,
    pointsLeft: null,
    turnsLeft: null,
  };
}

export async function spinReward() {
  try {
    await requireUserId();
    const result = await supabase.rpc('reward_spin');
    console.log('[rewards] vòng quay', { data: result.data, error: result.error });
    if (result.error) {
      console.log('Spin error:', result.error);
      throw new Error(friendlyRewardError(result.error, 'Không quay được.'));
    }
    return readPlayResult(result.data);
  } catch (error) {
    console.log('Spin error:', error);
    throw new Error(friendlyRewardError(error, 'Không quay được.'));
  }
}

export async function openMysteryBox() {
  try {
    await requireUserId();
    const result = await supabase.rpc('reward_open_box');
    console.log('[rewards] hộp quà', { data: result.data, error: result.error });
    if (result.error) {
      console.log('Box error:', result.error);
      throw new Error(friendlyRewardError(result.error, 'Không mở được hộp quà.'));
    }
    return readPlayResult(result.data);
  } catch (error) {
    console.log('Box error:', error);
    throw new Error(friendlyRewardError(error, 'Không mở được hộp quà.'));
  }
}

function mapPrizeRow(row) {
  return {
    id: row.id,
    prizeName: row.prize_name,
    prizeType: row.prize_type || 'coin',
    value: Number(row.value) || 0,
    probability: Number(row.probability) || 0,
    iconUrl: row.icon_url || '',
    sortOrder: Number(row.sort_order) || 0,
    status: row.is_active ? 'show' : 'hide',
  };
}

export async function fetchGamePrizes(kind) {
  const table = kind === 'box' ? 'mystery_prizes' : 'wheel_prizes';
  const result = await supabase
    .from(table)
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (result.error) return null;
  return (result.data || []).map(mapPrizeRow);
}

export async function redeemReward(rewardId) {
  if (!isUuid(rewardId)) throw new Error('Phần thưởng chưa sẵn sàng.');
  try {
    await requireUserId();
    const result = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
    console.log('[rewards] đổi quà', { rewardId, data: result.data, error: result.error });
    if (result.error) {
      console.log('Redeem error:', result.error);
      throw new Error(friendlyRewardError(result.error, 'Không đổi quà được.'));
    }
    return result.data || {};
  } catch (error) {
    console.log('Redeem error:', error);
    throw new Error(friendlyRewardError(error, 'Không đổi quà được.'));
  }
}

async function readCheckedInToday(userId, profile, tasks) {
  if (isVietnamToday(profile?.last_checkin_date)) return true;
  const daily = (tasks || []).find((task) => task.actionType === 'daily_checkin');
  if (daily && (daily.status === 'completed' || daily.status === 'claimed') && isVietnamToday(daily.updatedAt)) {
    return true;
  }
  if (!userId) return false;
  const row = await supabase
    .from('user_checkins')
    .select('checked_on')
    .eq('user_id', userId)
    .eq('checked_on', vietnamToday())
    .maybeSingle();
  return !row.error && Boolean(row.data?.checked_on);
}

async function loadRewardProfile(userId) {
  const full = await supabase
    .from('profiles')
    .select('reward_points, wallet_balance, reward_streak, last_checkin_date, lucky_spins, mystery_boxes, boost_credits')
    .eq('id', userId)
    .maybeSingle();
  if (!full.error) return full;
  return supabase.from('profiles').select('reward_points, wallet_balance').eq('id', userId).maybeSingle();
}

function activeFlag(status) {
  return status !== 'hide' && status !== 'off';
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function activePrizeTotal(rows) {
  return roundPercent((rows || []).reduce((sum, row) => {
    if (!activeFlag(row.status)) return sum;
    return sum + (Number(row.probability) || 0);
  }, 0));
}

export function normalizePrizeChances(prizes) {
  const active = (prizes || []).filter((prize) => (Number(prize.probability) || 0) > 0);
  const total = active.reduce((sum, prize) => sum + Number(prize.probability), 0);
  if (total <= 0) return [];
  let used = 0;
  return active.map((prize, index) => {
    const chance = index === active.length - 1
      ? roundPercent(100 - used)
      : roundPercent((Number(prize.probability) / total) * 100);
    used = roundPercent(used + chance);
    return { ...prize, chance };
  });
}

function splitRemainder(others, remainder) {
  const weights = others.map((item) => Math.max(0, Number(item.probability) || 0));
  const weight = weights.reduce((sum, value) => sum + value, 0);
  let used = 0;
  return others.map((item, index) => {
    const share = weight > 0 ? weights[index] / weight : 1 / others.length;
    const probability = index === others.length - 1
      ? roundPercent(remainder - used)
      : roundPercent(share * remainder);
    used = roundPercent(used + probability);
    return { id: item.id, probability: Math.max(0, probability) };
  });
}

async function savePrizeOdds(table, action, row, payload) {
  payload.probability = roundPercent(payload.probability);
  if (payload.probability > 100) {
    throw new Error('Tỷ lệ một giải không được quá 100%.');
  }

  const existing = await supabase.from(table).select('id, probability, is_active');
  if (existing.error) throw new Error(existing.error.message || 'Không đọc được danh sách giải.');

  const editingId = isUuid(row?.id) ? row.id : null;
  const nextActive = action !== 'delete' && payload.is_active && payload.probability > 0;
  const others = (existing.data || []).filter((item) => item.id !== editingId && item.is_active && Number(item.probability) > 0);
  let updates = [];

  if (!nextActive) {
    updates = others.length ? normalizePrizeChances(others).map((item) => ({ id: item.id, probability: item.chance })) : [];
  } else {
    const remainder = roundPercent(100 - payload.probability);
    if (others.length === 0 && remainder !== 0) {
      throw new Error('Giải đang hiện duy nhất phải để 100%.');
    }
    updates = remainder === 0
      ? others.map((item) => ({ id: item.id, probability: 0 }))
      : splitRemainder(others, remainder);
  }

  const total = roundPercent(
    (nextActive ? payload.probability : 0) + updates.reduce((sum, item) => sum + item.probability, 0)
  );
  if (total > 0 && Math.abs(total - 100) > 0.001) {
    throw new Error(`Tổng tỷ lệ các giải đang hiện phải bằng 100%. Hiện tại là ${total}%.`);
  }

  for (const item of updates) {
    if (!isUuid(item.id)) continue;
    const previous = roundPercent((existing.data || []).find((entry) => entry.id === item.id)?.probability);
    if (previous === item.probability) continue;
    const result = await supabase.from(table).update({ probability: item.probability }).eq('id', item.id);
    if (result.error) throw new Error(result.error.message || 'Không lưu được tỷ lệ.');
  }

  await writeRewardRow(table, action, row, payload);
}

async function writeRewardRow(table, action, row, payload) {
  const clean = { ...payload };
  delete clean.id;
  if ((action === 'update' || action === 'delete') && isUuid(row?.id)) {
    const result = action === 'delete'
      ? await supabase.from(table).delete().eq('id', row.id)
      : await supabase.from(table).update(clean).eq('id', row.id);
    if (result.error) throw new Error(result.error.message || 'Không lưu được.');
    return;
  }
  if (action === 'delete') {
    throw new Error('Mục này chỉ có trên màn hình. Hãy thêm mới để tạo bản ghi thật.');
  }
  const result = await supabase.from(table).insert(clean);
  if (result.error) throw new Error(result.error.message || 'Không lưu được.');
}

export async function fetchAdminRewardTasks() {
  const result = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (result.error) return null;
  return (result.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    actionType: row.action_type,
    groupKey: row.group_key || 'core',
    targetCount: String(row.target_count ?? 1),
    rewardPoints: String(row.reward_points ?? 0),
    status: row.is_active ? 'show' : 'hide',
    createdAt: row.created_at || '',
  }));
}

export async function fetchAdminRewards() {
  const result = await supabase.from('rewards').select('*').order('created_at', { ascending: false });
  if (result.error) return null;
  return (result.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    groupKey: row.group_key || 'wallet',
    value: String(row.value ?? 0),
    pointCost: String(row.point_cost ?? 0),
    stock: String(row.stock_quantity ?? 0),
    imageUrl: row.image_url || '',
    status: row.is_active ? 'show' : 'hide',
    createdAt: row.created_at || '',
  }));
}

async function fetchAdminPrizeTable(table) {
  const result = await supabase.from(table).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (result.error) return null;
  return (result.data || []).map((row) => ({
    ...mapPrizeRow(row),
    value: String(row.value ?? 0),
    probability: String(row.probability ?? 0),
    sortOrder: String(row.sort_order ?? 0),
  }));
}

export async function fetchAdminWheelPrizes() {
  return fetchAdminPrizeTable('wheel_prizes');
}

export async function fetchAdminMysteryPrizes() {
  return fetchAdminPrizeTable('mystery_prizes');
}

export async function fetchAdminRewardClaims() {
  const result = await supabase
    .from('reward_claims')
    .select('id, status, claim_code, created_at, user:profiles!user_id(full_name, phone), reward:rewards(title)')
    .order('created_at', { ascending: false });
  if (result.error) return null;
  return (result.data || []).map((row) => ({
    id: row.id,
    user: row.user?.full_name || row.user?.phone || 'Thành viên',
    reward: row.reward?.title || 'Quà đã xoá',
    status: row.status || 'pending',
    claimCode: row.claim_code || '',
    createdAt: row.created_at || '',
  }));
}

export async function saveRewardAdmin(kind, action, row) {
  if (kind === 'reward-claims' && action === 'create') {
    throw new Error('Yêu cầu đổi quà do người dùng tạo khi bấm Đổi ngay.');
  }

  if (kind === 'reward-tasks') {
    const payload = {
      title: String(row.title || '').trim(),
      description: String(row.description || '').trim(),
      action_type: row.actionType || 'complete_job',
      group_key: row.groupKey || 'core',
      target_count: Math.max(1, Number(row.targetCount) || 1),
      reward_points: Math.max(0, Number(row.rewardPoints) || 0),
      is_active: activeFlag(row.status),
    };
    if (action !== 'delete' && !payload.title) throw new Error('Cần nhập tên nhiệm vụ.');
    await writeRewardRow('tasks', action, row, payload);
    return;
  }

  if (kind === 'rewards') {
    const payload = {
      title: String(row.title || '').trim(),
      type: row.type || 'voucher',
      group_key: row.groupKey || 'wallet',
      point_cost: Math.max(0, Number(row.pointCost) || 0),
      value: Math.max(0, Number(row.value) || 0),
      stock_quantity: Math.max(0, Number(row.stock) || 0),
      image_url: String(row.imageUrl || '').trim() || null,
      is_active: activeFlag(row.status),
    };
    if (action !== 'delete' && !payload.title) throw new Error('Cần nhập tên phần thưởng.');
    await writeRewardRow('rewards', action, row, payload);
    return;
  }

  if (kind === 'wheel-prizes' || kind === 'mystery-prizes') {
    const payload = {
      prize_name: String(row.prizeName || '').trim(),
      prize_type: row.prizeType || 'coin',
      value: Math.max(0, Math.round(Number(row.value) || 0)),
      probability: Math.max(0, Number(row.probability) || 0),
      icon_url: String(row.iconUrl || '').trim() || null,
      sort_order: Math.round(Number(row.sortOrder) || 0),
      is_active: activeFlag(row.status),
    };
    if (action !== 'delete' && !payload.prize_name) throw new Error('Cần nhập tên giải.');
    await savePrizeOdds(kind === 'wheel-prizes' ? 'wheel_prizes' : 'mystery_prizes', action, row, payload);
    return;
  }

  if (!isUuid(row?.id)) {
    throw new Error('Yêu cầu này chưa có mã hợp lệ.');
  }
  if (action === 'delete') {
    await writeRewardRow('reward_claims', 'delete', row, {});
    return;
  }
  await writeRewardRow('reward_claims', 'update', row, {
    status: row.status || 'pending',
    claim_code: String(row.claimCode || '').trim() || null,
  });
}
