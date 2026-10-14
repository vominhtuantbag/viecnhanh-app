import { supabase } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
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
    return { missing, tasks: [], rewards: [], claims: [], points: 0 };
  }

  const progress = Object.fromEntries((progressResult.data || []).map((row) => [row.task_id, row]));
  return {
    missing: false,
    points: Number(profileResult.data?.reward_points) || 0,
    wallet: Number(profileResult.data?.wallet_balance) || 0,
    streak: Number(profileResult.data?.reward_streak) || 0,
    luckySpins: Number(profileResult.data?.lucky_spins) || 0,
    mysteryBoxes: Number(profileResult.data?.mystery_boxes) || 0,
    boostCredits: Number(profileResult.data?.boost_credits) || 0,
    claims: claimsResult.data || [],
    tasks: (tasksResult.data || []).map((row) => {
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
      };
    }),
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
  const result = await supabase.rpc('reward_daily_checkin');
  if (result.error) throw new Error(result.error.message || 'Không điểm danh được.');
  return Number(result.data) || 0;
}

export async function claimRewardTask(taskId) {
  if (!isUuid(taskId)) throw new Error('Nhiệm vụ chưa sẵn sàng.');
  const result = await supabase.rpc('claim_reward_task', { p_task_id: taskId });
  if (result.error) throw new Error(result.error.message || 'Không nhận xu được.');
  if (result.data && typeof result.data === 'object') return result.data;
  return { points: Number(result.data) || 0 };
}

export async function recordRewardAction(action) {
  const result = await supabase.rpc('reward_record_action', { p_action: action });
  if (result.error) return 0;
  return Number(result.data) || 0;
}

export async function spinReward() {
  const result = await supabase.rpc('reward_spin');
  if (result.error) throw new Error(result.error.message || 'Không quay được.');
  return Number(result.data) || 0;
}

export async function openMysteryBox() {
  const result = await supabase.rpc('reward_open_box');
  if (result.error) throw new Error(result.error.message || 'Không mở được hộp quà.');
  return Number(result.data) || 0;
}

export async function redeemReward(rewardId) {
  if (!isUuid(rewardId)) throw new Error('Phần thưởng chưa sẵn sàng.');
  const result = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
  if (result.error) throw new Error(result.error.message || 'Không đổi quà được.');
  return result.data || {};
}

async function loadRewardProfile(userId) {
  const full = await supabase
    .from('profiles')
    .select('reward_points, wallet_balance, reward_streak, lucky_spins, mystery_boxes, boost_credits')
    .eq('id', userId)
    .maybeSingle();
  if (!full.error) return full;
  return supabase.from('profiles').select('reward_points, wallet_balance').eq('id', userId).maybeSingle();
}

function activeFlag(status) {
  return status !== 'hide' && status !== 'off';
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
