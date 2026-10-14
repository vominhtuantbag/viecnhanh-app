import { createClient } from '@supabase/supabase-js';

import { countVisibleMains } from '@/data/catalog';
import { toAuthErrorMessage } from '@/lib/auth-errors';
import { parseVnPhone } from '@/lib/phone';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

export async function fetchAdminStats() {
  const [users, jobs, bids] = await Promise.all([
    supabase.from('profiles').select('id, created_at, is_admin', { count: 'exact' }),
    supabase.from('jobs').select('id, status, is_approved, created_at, category_id', { count: 'exact' }),
    supabase.from('bids').select('id, status, created_at', { count: 'exact' }),
  ]);

  const jobRows = jobs.data || [];
  const bidRows = bids.data || [];
  const userRows = users.data || [];

  const byStatus = {
    open: jobRows.filter((row) => row.status === 'approved').length,
    assigned: jobRows.filter((row) => row.status === 'assigned').length,
    completed: jobRows.filter((row) => row.status === 'completed').length,
    cancelled: jobRows.filter((row) => row.status === 'closed').length,
    pending: jobRows.filter((row) => row.status === 'pending' || row.is_approved === false).length,
  };

  const days = [];
  for (let i = 9; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    days.push({
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      key,
      count: jobRows.filter((row) => String(row.created_at || '').startsWith(key)).length,
    });
  }

  return {
    totalUsers: users.count ?? userRows.length,
    activeUsers: userRows.length,
    totalJobs: jobs.count ?? jobRows.length,
    openJobs: byStatus.open,
    totalBids: bids.count ?? bidRows.length,
    pendingBids: bidRows.filter((row) => row.status === 'pending').length,
    totalCategories: countVisibleMains(),
    pendingJobs: byStatus.pending,
    byStatus,
    trend: days,
    jobs: jobRows,
    users: userRows,
    bids: bidRows,
  };
}

export async function fetchAdminJobs() {
  const rich = await supabase
    .from('jobs')
    .select(
      'id, title, price, status, is_approved, created_at, category_id, province_id, ward_id, user_id, hired_worker_id, poster:profiles!user_id(full_name, phone), assignee:profiles!hired_worker_id(full_name), bids(id)'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (!rich.error) return rich.data || [];

  const plain = await supabase
    .from('jobs')
    .select('id, title, price, status, is_approved, created_at, category_id, user_id, poster:profiles!user_id(full_name, phone)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (plain.error) return [];
  return plain.data || [];
}

const USER_SELECTS = [
  'id, full_name, phone, email, wallet_balance, is_admin, referral_code, created_at, completed_jobs, id_verified, is_banned',
  'id, full_name, phone, email, wallet_balance, is_admin, referral_code, created_at, completed_jobs, id_verified',
  'id, full_name, phone, email, wallet_balance, is_admin, referral_code, created_at, completed_jobs',
];

export async function fetchAdminUsers() {
  let lastError = null;
  for (const columns of USER_SELECTS) {
    const result = await supabase
      .from('profiles')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!result.error) return result.data || [];
    lastError = result.error;
  }
  throw new Error(lastError?.message || 'Không tải được danh sách người dùng.');
}

export async function adminCreateUser({ name, phone, password, wallet }) {
  const parsed = parseVnPhone(phone);
  if (!parsed) throw new Error('Số điện thoại không hợp lệ. Dùng số Việt Nam, ví dụ 0912 345 678.');
  if (!password || password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.');

  const signup = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `viecnhanh-signup-${Date.now()}`,
    },
  });
  const created = await signup.auth.signUp({
    email: parsed.email,
    password,
    options: {
      data: {
        phone: parsed.e164,
        full_name: String(name || '').trim(),
        auth_provider: 'phone',
      },
    },
  });
  if (created.error) throw new Error(toAuthErrorMessage(created.error));
  if (!created.data?.user?.id) throw new Error('Không tạo được tài khoản.');

  const amount = Number(wallet);
  if (Number.isFinite(amount) && amount >= 0 && amount !== 50000) {
    await supabase.from('profiles').update({ wallet_balance: amount }).eq('id', created.data.user.id);
  }
  return created.data.user;
}

export async function fetchAdminBids() {
  const rich = await supabase
    .from('bids')
    .select(
      'id, proposed_price, status, message, created_at, job_id, worker_id, job:jobs(title), worker:profiles!worker_id(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (!rich.error) return rich.data || [];

  const plain = await supabase
    .from('bids')
    .select('id, proposed_price, status, created_at, job_id, worker_id')
    .order('created_at', { ascending: false })
    .limit(200);
  if (plain.error) return [];
  return plain.data || [];
}

export async function fetchAdminReviews() {
  const result = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, created_at, role, job:jobs(title), reviewer:profiles!reviewer_id(full_name), subject:profiles!worker_id(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (result.error) return [];
  return result.data || [];
}

export async function fetchAdminChats() {
  const result = await supabase
    .from('conversations')
    .select(
      'id, created_at, job:jobs(title), poster:profiles!poster_id(full_name), worker:profiles!worker_id(full_name), messages(body, created_at)'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (result.error) return [];
  return result.data || [];
}

export async function fetchAdminVouchers() {
  const result = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
  if (result.error) return [];
  return result.data || [];
}

export async function adminSetJobStatus(jobId, status, approved) {
  const result = await supabase.rpc('admin_set_job_status', {
    p_job_id: jobId,
    p_status: status,
    p_approved: approved,
  });
  if (result.error) throw new Error(result.error.message || 'Không cập nhật tin được.');
}

export async function adminUpsertVoucher({ code, title, amount, maxUses }) {
  const result = await supabase.rpc('admin_upsert_voucher', {
    p_code: code,
    p_title: title,
    p_amount: Number(amount) || 0,
    p_max_uses: maxUses ? Number(maxUses) : null,
  });
  if (result.error) throw new Error(result.error.message || 'Không lưu mã được.');
  return result.data;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

async function removeRow(table, id) {
  const result = await supabase.from(table).delete().eq('id', id);
  if (result.error) {
    throw new Error('Đã gỡ khỏi danh sách trên màn hình. Máy chủ chưa cho xoá hẳn mục này.');
  }
}

export async function syncAdminChange(page, action, row) {
  if (!page?.live) return;
  const saved = isUuid(row?.id);

  if (page.live === 'jobs' && saved) {
    if (action === 'delete') {
      await removeRow('jobs', row.id);
      return;
    }
    if (action === 'update') {
      const approved = row.status !== 'pending' && row.status !== 'closed';
      await adminSetJobStatus(row.id, row.status || 'pending', approved);
      if (row.title != null) {
        const patch = { title: row.title, price: Number(row.price) || 0 };
        if (row.categoryId) patch.category_id = row.categoryId;
        const result = await supabase.from('jobs').update(patch).eq('id', row.id);
        if (result.error) {
          throw new Error('Đã đổi trạng thái. Chưa sửa được tiêu đề hoặc giá trên máy chủ.');
        }
      }
    }
    return;
  }

  if (page.live === 'bids' && saved) {
    if (action === 'delete') {
      await removeRow('bids', row.id);
      return;
    }
    const result = await supabase
      .from('bids')
      .update({
        proposed_price: Number(row.price) || 0,
        status: row.status || 'pending',
      })
      .eq('id', row.id);
    if (result.error) throw new Error(result.error.message || 'Không sửa đề xuất được.');
    return;
  }

  if (page.live === 'users' && saved && action !== 'create') {
    if (action === 'delete') {
      await removeRow('profiles', row.id);
      return;
    }
    if (action === 'credit') {
      const result = await supabase
        .from('profiles')
        .update({ wallet_balance: Number(row.wallet) || 0 })
        .eq('id', row.id);
      if (result.error) throw new Error(result.error.message || 'Không cộng tiền được.');
      return;
    }
    if (action === 'ban') {
      const result = await supabase
        .from('profiles')
        .update({ is_banned: row.status === 'banned' })
        .eq('id', row.id);
      if (result.error) throw new Error('Đã đổi trên màn hình. Máy chủ chưa lưu được trạng thái khoá.');
      return;
    }
    if (action === 'verify') {
      const result = await supabase
        .from('profiles')
        .update({ id_verified: !!row.verified })
        .eq('id', row.id);
      if (result.error) throw new Error(result.error.message || 'Không cập nhật xác minh được.');
      return;
    }
    const patch = {
      full_name: row.name || '',
      phone: row.phone || null,
      is_admin: row.role === 'admin',
    };
    if (row.email != null) patch.email = row.email || null;
    if (row.wallet != null && row.wallet !== '') patch.wallet_balance = Number(row.wallet) || 0;
    const result = await supabase.from('profiles').update(patch).eq('id', row.id);
    if (result.error) throw new Error(result.error.message || 'Không sửa người dùng được.');
    return;
  }

  if (page.live === 'reviews' && saved && action !== 'create') {
    if (action === 'delete') {
      await removeRow('reviews', row.id);
      return;
    }
    const result = await supabase
      .from('reviews')
      .update({
        rating: Number(row.rating) || 5,
        comment: row.comment || '',
      })
      .eq('id', row.id);
    if (result.error) throw new Error(result.error.message || 'Không sửa đánh giá được.');
    return;
  }

  if (page.live === 'chats' && saved && action === 'delete') {
    await removeRow('conversations', row.id);
    return;
  }

  if (page.live === 'vouchers' && action !== 'delete') {
    if (!String(row.code || '').trim()) throw new Error('Cần nhập mã giảm giá.');
    await adminUpsertVoucher({
      code: row.code,
      title: row.title,
      amount: row.amount,
      maxUses: row.maxUses,
    });
    return;
  }

  if (page.live === 'vouchers' && action === 'delete' && saved) {
    await removeRow('vouchers', row.id);
  }
}
