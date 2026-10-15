import { supabase } from '@/lib/supabase';

export const SAMPLE_NOTIFICATIONS = [
  {
    id: 'sample-quote',
    title: 'Có người chào giá',
    body: 'Có đề xuất mới cho tin của bạn.',
    data: {},
    readAt: null,
    createdAt: new Date().toISOString(),
    sample: true,
  },
  {
    id: 'sample-approved',
    title: 'Việc được duyệt',
    body: 'Tin của bạn đã được mở.',
    data: {},
    readAt: new Date(Date.now() - 3600_000).toISOString(),
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    sample: true,
  },
  {
    id: 'sample-promo',
    title: 'Khuyến mãi tuần này',
    body: 'Mã giảm giá 10% dùng cho cả tuần nè!',
    data: {},
    readAt: new Date(Date.now() - 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
    sample: true,
  },
];

export function mapNotification(row) {
  return {
    id: row.id,
    title: row.title || 'Việc Nhanh',
    body: row.body || '',
    data: row.data || {},
    pushGroup: row.push_group || '',
    kind: row.kind || '',
    readAt: row.read_at || null,
    createdAt: row.created_at,
    sample: false,
  };
}

export async function fetchMyNotifications(userId) {
  if (!userId) return [];
  const result = await supabase
    .from('user_notifications')
    .select('id, title, body, data, push_group, kind, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (result.error) return null;
  return (result.data || []).map(mapNotification);
}

export async function markNotificationRead(id) {
  if (!id || String(id).startsWith('sample-')) return;
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return;
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}
