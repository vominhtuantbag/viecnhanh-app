import { parseVnPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

const LIST_COLUMNS = [
  'id',
  'title',
  'body',
  'image_url',
  'action_url',
  'audience',
  'targets',
  'target_label',
  'send_mode',
  'scheduled_at',
  'send_time',
  'recurrence',
  'weekday',
  'month_day',
  'status',
  'last_sent_at',
  'next_run_at',
  'sent_count',
  'last_error',
  'created_at',
].join(', ');

export function friendlyNotificationError(error) {
  const message = error?.message || (typeof error === 'string' ? error : '');
  if (
    /admin_notifications|admin_save_notification|process_due_admin|schema cache|PGRST205|42P01|42883/i.test(
      message
    )
  ) {
    return 'Máy chủ chưa có phần chiến dịch thông báo. Mở Supabase → SQL Editor, dán file supabase/migrate_admin_notifications.sql rồi bấm Run.';
  }
  return message || 'Không thực hiện được. Thử lại sau.';
}

function mapPerson(row) {
  return {
    id: row.id,
    name: row.full_name || row.name || 'Chưa đặt tên',
    phone: row.phone || '',
    email: row.email || '',
  };
}

export async function fetchAdminNotifications() {
  const processed = await supabase.rpc('process_due_admin_notifications');
  const result = await supabase
    .from('admin_notifications')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100);

  if (result.error) throw new Error(friendlyNotificationError(result.error));
  return {
    rows: result.data || [],
    processError: processed.error ? friendlyNotificationError(processed.error) : '',
  };
}

export async function saveAdminNotification(payload) {
  const result = await supabase.rpc('admin_save_notification_campaign', { p_payload: payload });
  if (result.error) throw new Error(friendlyNotificationError(result.error));
  return result.data;
}

export async function deleteAdminNotification(id) {
  const result = await supabase.rpc('admin_delete_notification_campaign', { p_id: id });
  if (result.error) throw new Error(friendlyNotificationError(result.error));
}

export async function searchProfilesForNotification(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  let request = supabase.from('profiles').select('id, full_name, phone, email').limit(8);

  if (uuidLike) {
    request = request.eq('id', q);
  } else {
    const safe = q.replace(/[%_,.*()]/g, '').slice(0, 40);
    if (safe.length < 2) return [];
    const phone = parseVnPhone(q);
    const clauses = [`full_name.ilike.%${safe}%`, `phone.ilike.%${safe}%`, `email.ilike.%${safe}%`];
    if (phone) clauses.push(`phone.eq.${phone.e164}`, `phone.ilike.%${phone.national}%`);
    request = request.or(clauses.join(','));
  }

  const result = await request;
  if (result.error) return [];
  return (result.data || []).map(mapPerson);
}

export async function uploadNotificationImage(file) {
  if (!file) throw new Error('Chưa chọn ảnh.');
  const ext = String(file.name || 'anh.jpg')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const result = await supabase.storage.from('notification-images').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (result.error) {
    throw new Error(result.error.message || 'Không tải được ảnh. Bạn có thể dán đường dẫn https:// thay thế.');
  }
  const { data } = supabase.storage.from('notification-images').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Không lấy được đường dẫn ảnh.');
  return data.publicUrl;
}
