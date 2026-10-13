import { supabase } from '@/lib/supabase';

export async function fetchMyReferrals(userId) {
  if (!userId) return [];
  const result = await supabase
    .from('referrals')
    .select('id, code, reward_amount, status, created_at, invitee:profiles!invitee_id(full_name)')
    .eq('inviter_id', userId)
    .order('created_at', { ascending: false });
  if (result.error) return [];
  return (result.data || []).map((row) => ({
    id: row.id,
    code: row.code,
    rewardAmount: Number(row.reward_amount) || 0,
    status: row.status,
    createdAt: row.created_at,
    inviteeName: row.invitee?.full_name || 'Thành viên mới',
  }));
}

export async function applyReferralCode(code) {
  const result = await supabase.rpc('apply_referral_code', { p_code: String(code || '').trim() });
  if (result.error) throw new Error(result.error.message || 'Không áp dụng mã giới thiệu được.');
  return Number(result.data) || 0;
}

export async function redeemVoucherCode(code) {
  const result = await supabase.rpc('redeem_voucher_code', { p_code: String(code || '').trim() });
  if (result.error) throw new Error(result.error.message || 'Không dùng mã giảm giá được.');
  return Number(result.data) || 0;
}

export function referralShareText(code) {
  return `Nhập mã ${code} khi đăng ký Việc Nhanh, cả hai cùng nhận thưởng vào ví!`;
}
