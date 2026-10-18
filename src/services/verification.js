import { supabase } from '@/lib/supabase';
import { signedDocUrl, uploadVerificationPhoto } from '@/services/uploads';

export const VERIFICATION_SEED = [
  {
    id: 'cccd',
    title: 'Thẻ Căn cước công dân',
    description: 'Ảnh mặt trước và mặt sau căn cước.',
    is_enabled: true,
    is_required: true,
    needs_back: true,
    sort_order: 1,
  },
  {
    id: 'blx',
    title: 'Bằng lái xe',
    description: 'Ảnh mặt trước và mặt sau bằng lái.',
    is_enabled: true,
    is_required: true,
    needs_back: true,
    sort_order: 2,
  },
];

const STATUS_LABEL = {
  missing: 'Chưa xác minh',
  pending: 'Chờ duyệt',
  approved: 'Đã xác minh',
  rejected: 'Từ chối',
};

export function statusLabel(status) {
  return STATUS_LABEL[status] || STATUS_LABEL.missing;
}

function missingTable(error) {
  return /verification_|schema cache|42P01|42703|PGRST205/i.test(error?.message || '');
}

function requiredSlots(requirements) {
  return (requirements || []).filter((item) => item.is_enabled && item.is_required);
}

function docFor(documents, requirementId, side) {
  return (documents || []).find((item) => item.requirement_id === requirementId && item.side === side) || null;
}

export function slotsFor(requirement) {
  return requirement?.needs_back ? ['front', 'back'] : ['front'];
}

export function requirementComplete(requirement, documents) {
  return slotsFor(requirement).every((side) => docFor(documents, requirement.id, side));
}

export function userReadyForReview(requirements, documents) {
  const required = requiredSlots(requirements);
  if (!required.length) return false;
  if (!required.every((item) => requirementComplete(item, documents))) return false;
  return required.some((item) =>
    slotsFor(item).some((side) => docFor(documents, item.id, side)?.status === 'pending')
  );
}

export function overallStatus(requirements, documents) {
  const required = requiredSlots(requirements);
  if (!required.length) return 'missing';
  const docs = required.flatMap((item) => slotsFor(item).map((side) => docFor(documents, item.id, side)));
  if (docs.some((item) => !item)) return 'missing';
  if (docs.some((item) => item.status === 'rejected')) return 'rejected';
  if (docs.every((item) => item.status === 'approved')) return 'approved';
  return 'pending';
}

async function listRequirements(admin) {
  const query = supabase.from('verification_requirements').select('*').order('sort_order', { ascending: true });
  const result = admin ? await query : await query.eq('is_enabled', true);
  if (result.error) {
    if (missingTable(result.error)) return { rows: VERIFICATION_SEED.filter((item) => admin || item.is_enabled), offline: true };
    throw new Error(result.error.message || 'Không tải được danh sách giấy tờ.');
  }
  return { rows: result.data || [], offline: false };
}

export async function fetchMyVerification(userId) {
  const requirements = await listRequirements(false);
  if (!userId || requirements.offline) {
    return { requirements: requirements.rows, documents: [], offline: requirements.offline };
  }
  const docs = await supabase
    .from('verification_documents')
    .select('*')
    .eq('user_id', userId);
  if (docs.error) {
    if (missingTable(docs.error)) {
      return { requirements: requirements.rows, documents: [], offline: true };
    }
    throw new Error(docs.error.message || 'Không tải được giấy tờ đã gửi.');
  }
  const documents = await Promise.all(
    (docs.data || []).map(async (row) => ({
      ...row,
      previewUrl: await signedDocUrl(row.storage_path),
    }))
  );
  return { requirements: requirements.rows, documents, offline: false };
}

export async function submitVerificationPhoto(userId, requirementId, side, asset) {
  const storagePath = await uploadVerificationPhoto(userId, requirementId, side, asset);
  const saved = await supabase
    .from('verification_documents')
    .upsert(
      {
        user_id: userId,
        requirement_id: requirementId,
        side,
        storage_path: storagePath,
        status: 'pending',
        reject_reason: null,
        reviewed_at: null,
      },
      { onConflict: 'user_id,requirement_id,side' }
    )
    .select('*')
    .single();
  if (saved.error) {
    if (missingTable(saved.error)) {
      throw new Error('Ảnh chưa gắn vào hồ sơ. Hãy chạy file SQL xác minh một lần trong Supabase.');
    }
    throw new Error(saved.error.message || 'Không lưu được giấy tờ.');
  }
  await supabase.from('profiles').update({ id_verified: false }).eq('id', userId);
  return {
    ...saved.data,
    previewUrl: asset.uri || (await signedDocUrl(storagePath)),
  };
}

export async function fetchAdminVerification() {
  const requirements = await listRequirements(true);
  if (requirements.offline) {
    return { requirements: requirements.rows, queue: [], offline: true };
  }
  const docs = await supabase.from('verification_documents').select('*').order('created_at', { ascending: false });
  if (docs.error) throw new Error(docs.error.message || 'Không tải được hồ sơ chờ duyệt.');
  const grouped = new Map();
  for (const row of docs.data || []) {
    const list = grouped.get(row.user_id) || [];
    list.push(row);
    grouped.set(row.user_id, list);
  }
  const pendingIds = [...grouped.entries()]
    .filter(([, documents]) => userReadyForReview(requirements.rows, documents))
    .map(([userId]) => userId);
  let people = [];
  if (pendingIds.length) {
    const profiles = await supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url')
      .in('id', pendingIds);
    if (profiles.error) throw new Error(profiles.error.message || 'Không tải được người dùng.');
    people = profiles.data || [];
  }
  const queue = await Promise.all(
    pendingIds.map(async (userId) => {
      const documents = await Promise.all(
        (grouped.get(userId) || []).map(async (row) => ({
          ...row,
          previewUrl: await signedDocUrl(row.storage_path),
        }))
      );
      const person = people.find((item) => item.id === userId);
      return {
        id: userId,
        name: person?.full_name || 'Thành viên',
        phone: person?.phone || '',
        avatarUrl: person?.avatar_url || '',
        documents,
      };
    })
  );
  return { requirements: requirements.rows, queue, offline: false };
}

export async function saveRequirement(action, row) {
  if (action === 'delete') {
    const removed = await supabase.from('verification_requirements').delete().eq('id', row.id);
    if (removed.error) throw new Error(removed.error.message || 'Không xoá được loại giấy tờ.');
    return;
  }
  const id = String(row.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `giay-${Date.now()}`;
  const saved = await supabase.from('verification_requirements').upsert({
    id,
    title: String(row.title || '').trim() || 'Giấy tờ',
    description: row.description || '',
    is_enabled: row.is_enabled !== false,
    is_required: Boolean(row.is_required),
    needs_back: row.needs_back !== false,
    sort_order: Number(row.sort_order) || 0,
  });
  if (saved.error) {
    if (missingTable(saved.error)) {
      throw new Error('Chưa lưu được quy tắc. Hãy chạy file SQL xác minh một lần trong Supabase.');
    }
    throw new Error(saved.error.message || 'Không lưu được loại giấy tờ.');
  }
}

export async function reviewVerification(userId, decision, reason) {
  const { rows } = await listRequirements(true);
  const docs = await supabase.from('verification_documents').select('*').eq('user_id', userId);
  if (docs.error) throw new Error(docs.error.message || 'Không đọc được giấy tờ.');
  const required = requiredSlots(rows);
  const stamp = new Date().toISOString();
  if (decision === 'approved') {
    const ids = (docs.data || [])
      .filter((item) =>
        required.some((rule) => rule.id === item.requirement_id && slotsFor(rule).includes(item.side))
      )
      .map((item) => item.id);
    if (!ids.length) throw new Error('Hồ sơ chưa đủ giấy tờ bắt buộc.');
    const updated = await supabase
      .from('verification_documents')
      .update({ status: 'approved', reject_reason: null, reviewed_at: stamp })
      .in('id', ids);
    if (updated.error) throw new Error(updated.error.message || 'Không duyệt được hồ sơ.');
    await supabase.from('profiles').update({ id_verified: true }).eq('id', userId);
    return;
  }
  const text = String(reason || '').trim();
  if (!text) throw new Error('Hãy nhập lý do từ chối.');
  const updated = await supabase
    .from('verification_documents')
    .update({ status: 'rejected', reject_reason: text, reviewed_at: stamp })
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (updated.error) throw new Error(updated.error.message || 'Không từ chối được hồ sơ.');
  await supabase.from('profiles').update({ id_verified: false }).eq('id', userId);
}
