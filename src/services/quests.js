import { supabase } from '@/lib/supabase';

export const MOCK_QUESTS = [
  {
    slug: 'daily_checkin',
    title: 'Điểm danh hằng ngày',
    description: 'Mở app và điểm danh mỗi ngày để nhận xu vào ví.',
    rewardAmount: 1000,
    requirementCount: 1,
    kind: 'daily',
    progress: 0,
    completed: false,
    claimed: false,
  },
  {
    slug: 'complete_profile',
    title: 'Hoàn tất hồ sơ',
    description: 'Thêm họ tên và số điện thoại để mọi người tin tưởng hơn.',
    rewardAmount: 2000,
    requirementCount: 1,
    kind: 'once',
    progress: 0,
    completed: false,
    claimed: false,
  },
  {
    slug: 'first_bid',
    title: 'Gửi đề xuất đầu tiên',
    description: 'Báo giá cho một công việc trên Khám phá.',
    rewardAmount: 3000,
    requirementCount: 1,
    kind: 'once',
    progress: 0,
    completed: false,
    claimed: false,
  },
  {
    slug: 'first_job_done',
    title: 'Hoàn thành đơn đầu tiên',
    description: 'Được thuê và hoàn thành xong một việc.',
    rewardAmount: 10000,
    requirementCount: 1,
    kind: 'once',
    progress: 0,
    completed: false,
    claimed: false,
  },
  {
    slug: 'invite_friend',
    title: 'Mời 1 người bạn',
    description: 'Bạn bè nhập mã giới thiệu của bạn khi đăng ký.',
    rewardAmount: 5000,
    requirementCount: 1,
    kind: 'once',
    progress: 0,
    completed: false,
    claimed: false,
  },
  {
    slug: 'five_jobs',
    title: 'Hoàn thành 5 việc',
    description: 'Tích lũy 5 công việc đã hoàn thành với vai trò thợ.',
    rewardAmount: 20000,
    requirementCount: 5,
    kind: 'once',
    progress: 0,
    completed: false,
    claimed: false,
  },
];

function mapQuest(row, progressRow, checkedToday) {
  const requirement = Number(row.requirement_count) || 1;
  const progress = Number(progressRow?.progress) || 0;
  const kind = row.kind || 'once';
  const completed =
    kind === 'daily' ? Boolean(checkedToday) : progress >= requirement || Boolean(progressRow?.completed_at);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    rewardAmount: Number(row.reward_amount) || 0,
    requirementCount: requirement,
    kind,
    sortOrder: Number(row.sort_order) || 0,
    progress: kind === 'daily' ? (checkedToday ? 1 : 0) : progress,
    completed,
    claimed: kind === 'daily' ? Boolean(checkedToday) : Boolean(progressRow?.claimed_at),
  };
}

export async function fetchQuests(userId) {
  const quests = await supabase.from('quests').select('*').eq('is_active', true).order('sort_order');
  if (quests.error) return MOCK_QUESTS;

  let progressRows = [];
  let checkedToday = false;
  if (userId) {
    const progress = await supabase.from('user_quests').select('*').eq('user_id', userId);
    progressRows = progress.data || [];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const checkin = await supabase
      .from('user_checkins')
      .select('checked_on')
      .eq('user_id', userId)
      .eq('checked_on', today)
      .maybeSingle();
    checkedToday = Boolean(checkin.data?.checked_on);
  }

  const byQuest = Object.fromEntries(progressRows.map((row) => [row.quest_id, row]));
  return (quests.data || [])
    .map((row) => mapQuest(row, byQuest[row.id], checkedToday))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function claimQuest(slug) {
  const result = await supabase.rpc('claim_quest_reward', { p_slug: slug });
  if (result.error) throw new Error(result.error.message || 'Không nhận thưởng được.');
  return Number(result.data) || 0;
}

export async function dailyCheckin() {
  const result = await supabase.rpc('daily_checkin');
  if (result.error) throw new Error(result.error.message || 'Không điểm danh được.');
  return Number(result.data) || 0;
}
