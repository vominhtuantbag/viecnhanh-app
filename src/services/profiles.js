import { isPhoneAliasEmail, parseVnPhone } from '@/lib/phone';
import { supabase, unwrap } from '@/lib/supabase';

export function isProfileComplete(profile) {
  return Boolean(profile?.full_name?.trim() && profile?.phone?.trim());
}

export function phoneFromAuthUser(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const direct = metadata.phone || user.phone || '';
  if (String(direct).trim()) return String(direct).trim();
  if (isPhoneAliasEmail(user.email)) {
    const local = String(user.email).split('@')[0];
    return parseVnPhone(local)?.e164 || null;
  }
  return null;
}

export function mapWorkerProfile(profile, extras = {}) {
  const reviewsCount = Number(
    extras.reviewsCount ?? profile?.reviewsCount ?? profile?.reviews_count ?? 0
  );
  const ratingAvg = Number(
    extras.ratingAvg ?? profile?.ratingAvg ?? profile?.rating_avg ?? 0
  );
  const completedJobs = Number(
    extras.completedJobs ?? profile?.completedJobs ?? profile?.completed_jobs ?? 0
  );

  return {
    id: profile?.id || extras.id || null,
    fullName:
      profile?.full_name?.trim() ||
      profile?.fullName?.trim() ||
      extras.fullName ||
      'Thợ Việc Nhanh',
    avatarUrl: profile?.avatar_url || profile?.avatarUrl || extras.avatarUrl || '',
    phone: profile?.phone || extras.phone || '',
    ratingAvg: Number.isFinite(ratingAvg) ? ratingAvg : 0,
    reviewsCount: Number.isFinite(reviewsCount) ? reviewsCount : 0,
    completedJobs: Number.isFinite(completedJobs) ? completedJobs : 0,
    idVerified: Boolean(
      extras.idVerified ?? profile?.idVerified ?? profile?.id_verified
    ),
  };
}

export function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'VN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export async function getProfileById(id) {
  if (!id) return null;
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
}

export function mapReview(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    subjectId: row.worker_id,
    reviewerId: row.reviewer_id,
    rating: Number(row.rating) || 0,
    comment: row.comment || '',
    role: row.role || 'worker',
    createdAt: row.created_at,
  };
}

export async function fetchPublicProfile(id) {
  const row = await getProfileById(id);
  if (!row) return null;

  const reviewsResult = await supabase
    .from('reviews')
    .select('*')
    .eq('worker_id', id)
    .order('created_at', { ascending: false });

  const reviews = reviewsResult.error ? [] : (reviewsResult.data || []).map(mapReview);
  const ratingAvg =
    reviews.length > 0
      ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
      : Number(row.rating_avg) || 0;

  return {
    ...mapWorkerProfile(row, {
      id,
      ratingAvg,
      reviewsCount: reviews.length || row.reviews_count,
    }),
    reviews,
  };
}

export async function ensureAuthProfile(user) {
  if (!user?.id) return null;

  const existing = await getProfileById(user.id);
  const metadata = user.user_metadata || {};
  const nextPhone = existing?.phone || phoneFromAuthUser(user);
  const nextName =
    existing?.full_name || metadata.full_name || metadata.name || null;
  const nextAvatar =
    existing?.avatar_url || metadata.avatar_url || metadata.picture || null;

  if (existing) {
    const patch = {};
    if (!existing.phone && nextPhone) patch.phone = nextPhone;
    if (!existing.full_name && nextName) patch.full_name = nextName;
    if (!existing.avatar_url && nextAvatar) patch.avatar_url = nextAvatar;
    if (!Object.keys(patch).length) return existing;
    return unwrap(
      await supabase.from('profiles').update(patch).eq('id', user.id).select().single()
    );
  }

  const created = await unwrap(
    await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email || metadata.email || null,
          phone: nextPhone,
          full_name: nextName,
          avatar_url: nextAvatar,
          wallet_balance: 50000,
        },
        { onConflict: 'id' }
      )
      .select()
      .single()
  );

  return created;
}

export async function updateProfile(userId, payload) {
  const row = {
    id: userId,
    full_name: payload.full_name?.trim() || null,
    phone: payload.phone?.trim() || null,
  };
  if (payload.email !== undefined) row.email = payload.email;
  if (payload.avatar_url !== undefined) row.avatar_url = payload.avatar_url;
  if (payload.notify_push !== undefined) row.notify_push = Boolean(payload.notify_push);
  if (payload.notify_new_jobs !== undefined) row.notify_new_jobs = Boolean(payload.notify_new_jobs);
  if (payload.notify_new_bids !== undefined) row.notify_new_bids = Boolean(payload.notify_new_bids);
  if (payload.notify_wallet !== undefined) row.notify_wallet = Boolean(payload.notify_wallet);
  if (payload.notify_messages !== undefined) row.notify_messages = Boolean(payload.notify_messages);
  if (payload.notify_hired !== undefined) row.notify_hired = Boolean(payload.notify_hired);
  if (payload.notify_hire_cancelled !== undefined) {
    row.notify_hire_cancelled = Boolean(payload.notify_hire_cancelled);
  }
  if (payload.notify_reviews !== undefined) row.notify_reviews = Boolean(payload.notify_reviews);
  if (payload.notify_promo !== undefined) row.notify_promo = Boolean(payload.notify_promo);
  if (payload.wallet_balance !== undefined) row.wallet_balance = Number(payload.wallet_balance) || 0;

  const existing = await getProfileById(userId);
  if (!existing) {
    row.wallet_balance = 50000;
  }

  return unwrap(
    await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select().single()
  );
}
