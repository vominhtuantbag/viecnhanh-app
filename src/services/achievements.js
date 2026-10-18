import { ACHIEVEMENTS } from '@/data/achievements';
import { supabase } from '@/lib/supabase';

function missingTable(error) {
  return /achievements|schema cache|does not exist|42P01|PGRST205/i.test(error?.message || '');
}

async function countOf(query) {
  const result = await query;
  if (result.error) return 0;
  return result.count || 0;
}

export async function loadProgress(userId, profile) {
  const progress = {
    checkin_streak: Number(profile?.reward_streak) || 0,
    points: Number(profile?.reward_points) || 0,
    profile_ready: profile?.full_name?.trim() && profile?.phone?.trim() ? 1 : 0,
    worker_completed: 0,
    worker_assigned: 0,
    worker_bids: 0,
    worker_stars: 0,
    host_posted: 0,
    host_hired: 0,
    host_completed: 0,
    host_reviews: 0,
    referrals: 0,
    views: 0,
    messages: 0,
  };
  if (!userId) return progress;

  const [
    workerDone,
    workerHired,
    bids,
    stars,
    posts,
    hires,
    hostDone,
    reviews,
    invites,
    views,
    messages,
  ] = await Promise.all([
    countOf(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('hired_worker_id', userId).eq('status', 'completed')),
    countOf(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('hired_worker_id', userId).not('hired_worker_id', 'is', null)),
    countOf(supabase.from('bids').select('id', { count: 'exact', head: true }).eq('worker_id', userId)),
    countOf(supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('worker_id', userId).gte('rating', 5)),
    countOf(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    countOf(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('hired_worker_id', 'is', null)),
    countOf(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed')),
    countOf(supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('reviewer_id', userId)),
    countOf(supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('inviter_id', userId)),
    countOf(supabase.from('job_views').select('job_id', { count: 'exact', head: true }).eq('viewer_id', userId)),
    countOf(supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', userId)),
  ]);

  progress.worker_completed = workerDone;
  progress.worker_assigned = workerHired;
  progress.worker_bids = bids;
  progress.worker_stars = stars;
  progress.host_posted = posts;
  progress.host_hired = hires;
  progress.host_completed = hostDone;
  progress.host_reviews = reviews;
  progress.referrals = invites;
  progress.views = views;
  progress.messages = messages;
  return progress;
}

function fromSeed(item) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    actionType: item.actionType,
    targetCount: item.targetCount,
    rewardCoins: item.rewardCoins,
    badgeName: item.badgeName,
    iconUrl: item.icon,
    isActive: true,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    actionType: row.action_type,
    targetCount: Number(row.target_count) || 1,
    rewardCoins: Number(row.reward_coins) || 0,
    badgeName: row.badge_name || '',
    iconUrl: row.icon_url || 'trophy-outline',
    isActive: row.is_active !== false,
  };
}

export async function loadAchievements(userId, profile) {
  const listed = await supabase.from('achievements').select('*').order('target_count', { ascending: true });
  const missing = Boolean(listed.error);
  const source = listed.error ? ACHIEVEMENTS.map(fromSeed) : (listed.data || []).map(fromRow).filter((item) => item.isActive);
  const claims = userId
    ? await supabase.from('user_achievements').select('achievement_id').eq('user_id', userId)
    : { data: [] };
  const claimed = new Set((claims.data || []).map((row) => row.achievement_id));
  const progress = await loadProgress(userId, profile);
  return {
    missing,
    items: source.map((item) => ({
      ...item,
      current: Number(progress[item.actionType]) || 0,
      claimed: claimed.has(item.id),
    })),
  };
}

export async function claimAchievement(userId, item) {
  if (!userId) throw new Error('Vui lòng đăng nhập.');
  if (item.current < item.targetCount) throw new Error('Bạn chưa đạt mốc này.');
  const inserted = await supabase.from('user_achievements').insert({
    user_id: userId,
    achievement_id: item.id,
  });
  if (inserted.error) {
    if (inserted.error.code === '23505') throw new Error('Bạn đã nhận thưởng này rồi.');
    if (missingTable(inserted.error)) {
      throw new Error('Kho thành tựu chưa sẵn sàng. Quản trị cần chạy file SQL thành tựu một lần.');
    }
    throw new Error(inserted.error.message || 'Không nhận được thưởng.');
  }
  const profile = await supabase.from('profiles').select('reward_points').eq('id', userId).maybeSingle();
  const nextPoints = (Number(profile.data?.reward_points) || 0) + (Number(item.rewardCoins) || 0);
  if (!profile.error) {
    await supabase.from('profiles').update({ reward_points: nextPoints }).eq('id', userId);
  }
  return nextPoints;
}

function adminRow(item) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    badgeName: item.badgeName,
    category: item.category,
    actionType: item.actionType,
    targetCount: String(item.targetCount),
    rewardCoins: String(item.rewardCoins),
    iconUrl: item.iconUrl || '',
    status: item.isActive ? 'show' : 'hide',
  };
}

export async function fetchAdminAchievements() {
  const result = await supabase.from('achievements').select('*').order('category', { ascending: true }).order('target_count', { ascending: true });
  if (result.error) {
    if (missingTable(result.error)) return ACHIEVEMENTS.map(fromSeed).map(adminRow);
    return null;
  }
  return (result.data || []).map(fromRow).map(adminRow);
}

export async function saveAchievementAdmin(action, row) {
  const id = String(row.id || '').trim() || `ach-${Date.now()}`;
  if (action === 'delete') {
    const removed = await supabase.from('achievements').delete().eq('id', id);
    if (removed.error) {
      if (missingTable(removed.error)) {
        throw new Error('Kho thành tựu chưa sẵn sàng. Hãy chạy file supabase/migrate_achievements.sql.');
      }
      throw new Error(removed.error.message || 'Không xoá được.');
    }
    return;
  }
  const payload = {
    id,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    badge_name: String(row.badgeName || '').trim(),
    category: row.category || 'general',
    action_type: row.actionType || 'worker_completed',
    target_count: Math.max(1, Number(row.targetCount) || 1),
    reward_coins: Math.max(0, Number(row.rewardCoins) || 0),
    icon_url: String(row.iconUrl || '').trim() || null,
    is_active: row.status !== 'hide',
  };
  if (!payload.title) throw new Error('Cần nhập tên thành tựu.');
  const saved = action === 'create'
    ? await supabase.from('achievements').insert(payload)
    : await supabase.from('achievements').update(payload).eq('id', id);
  if (saved.error) {
    if (missingTable(saved.error)) {
      throw new Error('Kho thành tựu chưa sẵn sàng. Hãy chạy file supabase/migrate_achievements.sql.');
    }
    throw new Error(saved.error.message || 'Không lưu được thành tựu.');
  }
}
