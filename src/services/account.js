import { supabase, unwrap } from '@/lib/supabase';

export const PAYMENT_KINDS = [
  { id: 'bank', label: 'Tài khoản ngân hàng' },
  { id: 'momo', label: 'Ví MoMo' },
  { id: 'zalopay', label: 'ZaloPay' },
  { id: 'cash', label: 'Tiền mặt khi hoàn thành' },
];

export function paymentKindLabel(kind) {
  return PAYMENT_KINDS.find((item) => item.id === kind)?.label || kind;
}

export function mapPaymentMethod(row) {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    label: row.label || paymentKindLabel(row.kind),
    accountName: row.account_name || '',
    accountNumber: row.account_number || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

export async function fetchPaymentMethods(userId) {
  const rows = unwrap(
    await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  );
  return (rows || []).map(mapPaymentMethod);
}

export async function createPaymentMethod(userId, payload) {
  if (payload.isDefault) {
    await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', userId);
  }
  return mapPaymentMethod(
    unwrap(
      await supabase
        .from('payment_methods')
        .insert({
          user_id: userId,
          kind: payload.kind,
          label: payload.label?.trim() || paymentKindLabel(payload.kind),
          account_name: payload.accountName?.trim() || '',
          account_number: payload.accountNumber?.trim() || '',
          is_default: Boolean(payload.isDefault),
        })
        .select()
        .single()
    )
  );
}

export async function deletePaymentMethod(id) {
  await unwrap(await supabase.from('payment_methods').delete().eq('id', id));
}

export async function setDefaultPaymentMethod(userId, id) {
  await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', userId);
  await unwrap(
    await supabase.from('payment_methods').update({ is_default: true }).eq('id', id).eq('user_id', userId)
  );
}

export async function adjustWallet(userId, currentBalance, delta) {
  const next = Math.max(0, (Number(currentBalance) || 0) + Number(delta));
  return unwrap(
    await supabase
      .from('profiles')
      .update({ wallet_balance: next })
      .eq('id', userId)
      .select()
      .single()
  );
}

export async function fetchDashboardStats(userId) {
  const posted = await supabase
    .from('jobs')
    .select('id, price, status, hired_worker_id')
    .eq('user_id', userId);

  const accepted = await supabase
    .from('bids')
    .select('id, proposed_price, status, job_id')
    .eq('worker_id', userId)
    .eq('status', 'accepted');

  const allBids = await supabase
    .from('bids')
    .select('id, status')
    .eq('worker_id', userId);

  const done = await supabase
    .from('jobs')
    .select('id')
    .eq('hired_worker_id', userId)
    .eq('status', 'completed');

  const postedJobs = posted.data || [];
  const acceptedBids = accepted.data || [];
  const workerBids = allBids.data || [];

  const income = acceptedBids.reduce((sum, row) => sum + (Number(row.proposed_price) || 0), 0);
  const postedBudget = postedJobs.reduce((sum, row) => sum + (Number(row.price) || 0), 0);

  return {
    postedCount: postedJobs.length,
    openPostedCount: postedJobs.filter((job) => job.status === 'approved' && !job.hired_worker_id).length,
    hiredPostedCount: postedJobs.filter((job) => job.status === 'assigned').length,
    completedJobs: (done.data || []).length,
    bidCount: workerBids.length,
    income,
    postedBudget,
  };
}
