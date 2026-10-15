import { BID_FEE, JOB_STATUS, jobFlowStatus, shouldAutoApproveJob } from '@/data/jobs';
import { supabase, unwrap } from '@/lib/supabase';
import { getProfileById, mapWorkerProfile } from '@/services/profiles';

const LOCAL_JOBS_KEY = 'viecnhanh_local_jobs';

function webStorage() {
  try {
    const store = globalThis.localStorage;
    if (store && typeof store.getItem === 'function') return store;
  } catch {
    return null;
  }
  return null;
}

export function readLocalJobs() {
  try {
    const store = webStorage();
    if (!store) return [];
    const raw = store.getItem(LOCAL_JOBS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeLocalJobs(jobs) {
  try {
    const store = webStorage();
    if (!store) return;
    const locals = jobs.filter((job) => String(job.id).startsWith('local-'));
    store.setItem(LOCAL_JOBS_KEY, JSON.stringify(locals));
  } catch {
    // Keep jobs in memory if storage is unavailable.
  }
}

// hired_bid_id cũng trỏ bids ↔ jobs, nên phải hint cột job_id.
const JOB_SELECT = '*, poster:profiles!user_id(*), bids!job_id(*, worker:profiles!worker_id(*))';
const JOB_SELECT_SIMPLE = '*, bids!job_id(*)';

export { BID_FEE };

function classifyBidError(message) {
  const text = String(message || '');
  if (text.includes('INSUFFICIENT_FUNDS') || text.toLowerCase().includes('không đủ')) {
    const error = new Error('Số dư ví không đủ để gửi đề xuất');
    error.code = 'INSUFFICIENT_FUNDS';
    return error;
  }
  if (
    text.includes('BID_EXISTS') ||
    text.includes('23505') ||
    text.toLowerCase().includes('duplicate') ||
    text.toLowerCase().includes('đã gửi đề xuất')
  ) {
    const error = new Error(
      'Bạn đã gửi đề xuất cho công việc này rồi. Mỗi tin đăng chỉ được đề xuất 1 lần.'
    );
    error.code = 'BID_EXISTS';
    return error;
  }
  return new Error(text || 'Không gửi được đề xuất.');
}

export function mapBid(row) {
  const workerRow = row.worker || row.profiles || null;
  return {
    id: row.id,
    jobId: row.job_id,
    workerId: row.worker_id,
    amount: Number(row.proposed_price) || 0,
    note: row.message || '',
    status: row.status,
    cancelReason: row.cancel_reason || '',
    seenByPoster: Boolean(row.seen_by_poster_at),
    worker: mapWorkerProfile(workerRow, { id: row.worker_id }),
  };
}

export function hasWorkerBid(job, workerId) {
  if (!job || !workerId) return false;
  return (job.quotes || []).some((quote) => quote.workerId === workerId);
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows || []) {
    const id = row?.[key];
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function averageRatings(rows) {
  const sums = {};
  const counts = {};
  for (const row of rows || []) {
    const id = row?.worker_id;
    const rating = Number(row?.rating);
    if (!id || !Number.isFinite(rating)) continue;
    sums[id] = (sums[id] || 0) + rating;
    counts[id] = (counts[id] || 0) + 1;
  }
  const averages = {};
  for (const id of Object.keys(counts)) {
    averages[id] = sums[id] / counts[id];
  }
  return { averages, counts };
}

export async function enrichBidsWithWorkers(jobsInput) {
  const isArray = Array.isArray(jobsInput);
  const jobs = (isArray ? jobsInput : jobsInput ? [jobsInput] : []).filter(Boolean);
  const workerIds = [
    ...new Set(
      jobs.flatMap((job) => (job.bids || []).map((bid) => bid.worker_id).filter(Boolean))
    ),
  ];

  if (!workerIds.length) return jobsInput;

  const { data: profiles } = await supabase.from('profiles').select('*').in('id', workerIds);

  const { data: completedJobs } = await supabase
    .from('jobs')
    .select('hired_worker_id')
    .in('hired_worker_id', workerIds)
    .eq('status', 'completed');

  const completedMap = countBy(completedJobs, 'hired_worker_id');

  let reviewAverages = {};
  let reviewCounts = {};
  const reviewsResult = await supabase
    .from('reviews')
    .select('worker_id, rating')
    .in('worker_id', workerIds);
  if (!reviewsResult.error) {
    const stats = averageRatings(reviewsResult.data);
    reviewAverages = stats.averages;
    reviewCounts = stats.counts;
  }

  const profileMap = Object.fromEntries((profiles || []).map((row) => [row.id, row]));

  for (const job of jobs) {
    job.bids = (job.bids || []).map((bid) => {
      const profile = profileMap[bid.worker_id];
      return {
        ...bid,
        worker: mapWorkerProfile(profile, {
          id: bid.worker_id,
          ratingAvg: reviewAverages[bid.worker_id] ?? profile?.rating_avg,
          reviewsCount: reviewCounts[bid.worker_id] ?? profile?.reviews_count,
          completedJobs: completedMap[bid.worker_id] ?? profile?.completed_jobs,
        }),
      };
    });
  }

  return isArray ? jobs : jobs[0];
}

export async function enrichJobsWithPosters(jobsInput) {
  const isArray = Array.isArray(jobsInput);
  const jobs = (isArray ? jobsInput : jobsInput ? [jobsInput] : []).filter(Boolean);
  const posterIds = [...new Set(jobs.map((job) => job.user_id).filter(Boolean))];
  if (!posterIds.length) return jobsInput;

  const { data: profiles } = await supabase.from('profiles').select('*').in('id', posterIds);

  let reviewAverages = {};
  let reviewCounts = {};
  const reviewsResult = await supabase
    .from('reviews')
    .select('worker_id, rating')
    .in('worker_id', posterIds);
  if (!reviewsResult.error) {
    const stats = averageRatings(reviewsResult.data);
    reviewAverages = stats.averages;
    reviewCounts = stats.counts;
  }

  const { data: completedJobs } = await supabase
    .from('jobs')
    .select('hired_worker_id')
    .in('hired_worker_id', posterIds)
    .eq('status', 'completed');
  const completedMap = countBy(completedJobs, 'hired_worker_id');
  const profileMap = Object.fromEntries((profiles || []).map((row) => [row.id, row]));

  for (const job of jobs) {
    const profile = job.poster || profileMap[job.user_id];
    job.poster = mapWorkerProfile(profile, {
      id: job.user_id,
      ratingAvg: reviewAverages[job.user_id] ?? profile?.rating_avg,
      reviewsCount: reviewCounts[job.user_id] ?? profile?.reviews_count,
      completedJobs: completedMap[job.user_id] ?? profile?.completed_jobs,
    });
  }

  return isArray ? jobs : jobs[0];
}

export function createLocalJob(profileId, payload, { autoApprove = true } = {}) {
  const now = new Date();
  return {
    id: `local-${now.getTime()}`,
    userId: profileId,
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    price: Number(payload.price) || 0,
    provinceId: payload.provinceId,
    wardId: payload.wardId,
    status: autoApprove ? JOB_STATUS.APPROVED : JOB_STATUS.PENDING,
    isApproved: autoApprove,
    views: 0,
    hiredWorkerId: null,
    hiredBidId: null,
    hireCancelReason: null,
    completedAt: null,
    createdAt: now.toISOString(),
    dateLabel: now.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    distanceKm: 0,
    latitude: Number(payload.latitude) || null,
    longitude: Number(payload.longitude) || null,
    categoryId: payload.categoryId || '',
    isMine: true,
    questions: 0,
    quotes: [],
    poster: mapWorkerProfile(null, { id: profileId }),
  };
}

export function mapJob(row, profileId) {
  const bids = Array.isArray(row.bids) ? row.bids : [];
  const createdAt = row.created_at ? new Date(row.created_at) : null;

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    price: Number(row.price) || 0,
    provinceId: row.province_id,
    wardId: row.ward_id,
    status: jobFlowStatus({
      status: row.status,
      isApproved: Boolean(row.is_approved),
      hiredWorkerId: row.hired_worker_id || null,
    }),
    isApproved: Boolean(row.is_approved),
    views: row.views_count ?? 0,
    hiredWorkerId: row.hired_worker_id || null,
    hiredBidId: row.hired_bid_id || null,
    hireCancelReason: row.hire_cancel_reason || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    dateLabel: createdAt
      ? createdAt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'Linh hoạt',
    distanceKm: 0,
    latitude: row.latitude == null || row.latitude === '' ? null : Number(row.latitude),
    longitude: row.longitude == null || row.longitude === '' ? null : Number(row.longitude),
    categoryId: row.category_id || '',
    isMine: Boolean(profileId && row.user_id === profileId),
    questions: 0,
    poster: mapWorkerProfile(row.poster, { id: row.user_id }),
    quotes: bids
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(mapBid),
  };
}

export async function fetchJobs() {
  const withBids = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .order('created_at', { ascending: false });

  if (!withBids.error) {
    return enrichJobsWithPosters(await enrichBidsWithWorkers(withBids.data ?? []));
  }

  const fallback = await supabase
    .from('jobs')
    .select('*, bids(*)')
    .order('created_at', { ascending: false });

  if (!fallback.error) {
    return enrichJobsWithPosters(await enrichBidsWithWorkers(fallback.data ?? []));
  }

  return unwrap(
    await supabase.from('jobs').select('*').order('created_at', { ascending: false })
  );
}

export async function fetchJobById(id) {
  let result = await supabase.from('jobs').select(JOB_SELECT).eq('id', id).maybeSingle();
  if (result.error) {
    result = await supabase.from('jobs').select('*, bids(*)').eq('id', id).maybeSingle();
  }
  if (result.error) {
    result = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  }
  if (result.error) {
    throw new Error(result.error.message || 'Không tải được tin đăng.');
  }
  if (!result.data) return null;
  return enrichJobsWithPosters(await enrichBidsWithWorkers(result.data));
}

export async function createJobRecord(profileId, payload, existingJobs = []) {
  let autoApprove = shouldAutoApproveJob(existingJobs, profileId);

  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId)
    .eq('status', 'approved');

  if (!error && (count ?? 0) > 0) {
    autoApprove = false;
  }

  const row = {
    user_id: profileId,
    title: payload.title.trim(),
    description: payload.description.trim(),
    price: Number(payload.price) || 0,
    province_id: payload.provinceId,
    ward_id: payload.wardId,
    category_id: payload.categoryId || null,
    status: autoApprove ? 'approved' : 'pending',
    is_approved: autoApprove,
    views_count: 0,
  };
  if (payload.latitude != null && payload.longitude != null && payload.latitude !== '' && payload.longitude !== '') {
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      row.latitude = latitude;
      row.longitude = longitude;
    }
  }

  const inserted = await supabase.from('jobs').insert(row).select(JOB_SELECT).single();
  if (!inserted.error) return inserted.data;
  if (row.latitude != null && /latitude|longitude|42703/i.test(inserted.error.message || '')) {
    delete row.latitude;
    delete row.longitude;
    return unwrap(await supabase.from('jobs').insert(row).select(JOB_SELECT).single());
  }
  return unwrap(inserted);
}

export async function recordUniqueJobView(jobId, { viewerId, ownerId } = {}) {
  if (!jobId || !viewerId || viewerId === ownerId) {
    return null;
  }

  const rpc = await supabase.rpc('record_job_view', { p_job_id: jobId });
  if (!rpc.error && rpc.data != null) {
    return Number(rpc.data) || 0;
  }

  const existing = await supabase
    .from('job_views')
    .select('job_id')
    .eq('job_id', jobId)
    .eq('viewer_id', viewerId)
    .maybeSingle();

  if (existing.data?.job_id) {
    const job = await supabase.from('jobs').select('views_count').eq('id', jobId).maybeSingle();
    return job.data?.views_count ?? null;
  }

  const inserted = await supabase.from('job_views').insert({ job_id: jobId, viewer_id: viewerId });
  if (inserted.error && inserted.error.code !== '23505') {
    return null;
  }

  const counted = await supabase
    .from('job_views')
    .select('viewer_id', { count: 'exact', head: true })
    .eq('job_id', jobId);

  const nextCount = counted.count ?? 0;
  await supabase.from('jobs').update({ views_count: nextCount }).eq('id', jobId);
  return nextCount;
}

export async function incrementJobViews(id) {
  return recordUniqueJobView(id);
}

export async function hireBidRecord(bidId) {
  const { data, error } = await supabase.rpc('hire_worker', { p_bid_id: bidId });
  if (!error) return data;
  if (!isMissingRpc(error, 'hire_worker')) {
    throw new Error(error.message || 'Không thuê được thợ.');
  }

  const bid = unwrap(
    await supabase.from('bids').select('*, jobs(*)').eq('id', bidId).maybeSingle()
  );
  if (!bid) {
    throw new Error('Không tìm thấy đề xuất.');
  }
  const job = bid.jobs;
  if (job?.status === 'completed') {
    throw new Error('Công việc đã hoàn thành.');
  }
  if (job?.hired_worker_id) {
    throw new Error('Tin đăng này đã thuê thợ.');
  }

  await unwrap(
    await supabase
      .from('bids')
      .update({ status: 'rejected' })
      .eq('job_id', bid.job_id)
      .neq('id', bidId)
  );
  await unwrap(await supabase.from('bids').update({ status: 'accepted' }).eq('id', bidId));
  return unwrap(
    await supabase
      .from('jobs')
      .update({
        hired_worker_id: bid.worker_id,
        hired_bid_id: bidId,
        status: JOB_STATUS.ASSIGNED,
        hire_cancel_reason: null,
        completed_at: null,
      })
      .eq('id', bid.job_id)
      .select(JOB_SELECT)
      .single()
  );
}

export async function cancelHireRecord(jobId, reason) {
  const reasonText = String(reason || '').trim();
  if (!reasonText) {
    throw new Error('Vui lòng chọn lý do hủy thuê.');
  }

  const rpc = await supabase.rpc('cancel_hire', { p_job_id: jobId, p_reason: reasonText });
  if (!rpc.error) return rpc.data;
  if (!isMissingRpc(rpc.error, 'cancel_hire')) {
    throw new Error(rpc.error.message || 'Không hủy thuê được.');
  }

  const job = unwrap(await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle());
  if (!job) throw new Error('Không tìm thấy tin đăng.');
  if (job.status === 'completed') {
    throw new Error('Công việc đã hoàn thành, không thể hủy thuê.');
  }
  if (!job.hired_worker_id && job.status !== 'assigned') {
    throw new Error('Tin đăng chưa thuê thợ.');
  }

  if (job.hired_bid_id) {
    await supabase
      .from('bids')
      .update({ status: 'cancelled', cancel_reason: reasonText })
      .eq('id', job.hired_bid_id);
  } else if (job.hired_worker_id) {
    await supabase
      .from('bids')
      .update({ status: 'cancelled', cancel_reason: reasonText })
      .eq('job_id', jobId)
      .eq('worker_id', job.hired_worker_id);
  }

  await supabase.from('bids').update({ status: 'pending' }).eq('job_id', jobId).eq('status', 'rejected');

  return unwrap(
    await supabase
      .from('jobs')
      .update({
        hired_worker_id: null,
        hired_bid_id: null,
        status: JOB_STATUS.APPROVED,
        hire_cancel_reason: reasonText,
        completed_at: null,
      })
      .eq('id', jobId)
      .select(JOB_SELECT)
      .single()
  );
}

export async function completeJobRecord(jobId) {
  const rpc = await supabase.rpc('complete_job', {
    p_job_id: jobId,
    p_rating: null,
    p_comment: '',
  });
  if (!rpc.error) return rpc.data;
  if (!isMissingRpc(rpc.error, 'complete_job')) {
    throw new Error(rpc.error.message || 'Không hoàn tất được công việc.');
  }

  const job = unwrap(await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle());
  if (!job) throw new Error('Không tìm thấy tin đăng.');
  if (job.status === 'completed') return job;
  if (!job.hired_worker_id) {
    throw new Error('Chưa thuê thợ nên không thể hoàn tất.');
  }

  return unwrap(
    await supabase
      .from('jobs')
      .update({
        status: JOB_STATUS.COMPLETED,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select(JOB_SELECT)
      .single()
  );
}

export async function closeJobRecord(jobId) {
  const job = unwrap(await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle());
  if (!job) throw new Error('Không tìm thấy tin đăng.');
  if (job.status === JOB_STATUS.COMPLETED) {
    throw new Error('Công việc đã hoàn thành, không thể gỡ tin.');
  }
  if (job.status === JOB_STATUS.ASSIGNED || job.hired_worker_id) {
    throw new Error('Hãy hủy thuê thợ trước khi gỡ tin đăng.');
  }

  return unwrap(
    await supabase
      .from('jobs')
      .update({
        status: JOB_STATUS.CLOSED,
        is_approved: false,
        hired_worker_id: null,
        hired_bid_id: null,
      })
      .eq('id', jobId)
      .select(JOB_SELECT)
      .single()
  );
}

function isMissingColumn(error, column) {
  const text = String(error?.message || error?.details || '').toLowerCase();
  return text.includes(String(column).toLowerCase()) && text.includes('does not exist');
}

export async function fetchMyReviewForJob(jobId, userId) {
  if (!jobId || !userId) return null;
  const result = await supabase
    .from('reviews')
    .select('*')
    .eq('job_id', jobId)
    .eq('reviewer_id', userId)
    .maybeSingle();
  if (result.error) return null;
  return result.data || null;
}

async function insertReviewRow({ jobId, subjectId, reviewerId, rating, comment, role }) {
  const withRole = await supabase
    .from('reviews')
    .insert({
      job_id: jobId,
      worker_id: subjectId,
      reviewer_id: reviewerId,
      rating,
      comment,
      role,
    })
    .select('*')
    .maybeSingle();

  if (!withRole.error) return withRole.data;
  if (!isMissingColumn(withRole.error, 'role')) {
    throw new Error(withRole.error.message || 'Không gửi được đánh giá.');
  }

  const withoutRole = await supabase
    .from('reviews')
    .insert({
      job_id: jobId,
      worker_id: subjectId,
      reviewer_id: reviewerId,
      rating,
      comment,
    })
    .select('*')
    .maybeSingle();

  if (withoutRole.error) {
    throw new Error(withoutRole.error.message || 'Không gửi được đánh giá.');
  }
  return withoutRole.data;
}

export async function submitJobReview(jobId, { rating, comment } = {}) {
  const ratingValue = Number(rating);
  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    throw new Error('Điểm đánh giá phải từ 1 đến 5.');
  }

  const rpc = await supabase.rpc('submit_job_review', {
    p_job_id: jobId,
    p_rating: ratingValue,
    p_comment: String(comment || '').trim(),
  });
  if (!rpc.error) return rpc.data;
  if (!isMissingRpc(rpc.error, 'submit_job_review')) {
    throw new Error(rpc.error.message || 'Không gửi được đánh giá.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Cần đăng nhập để đánh giá.');

  const job = unwrap(await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle());
  if (!job) throw new Error('Không tìm thấy tin đăng.');
  if (job.status !== 'completed') {
    throw new Error('Chỉ đánh giá sau khi công việc đã thanh toán.');
  }

  const existing = await fetchMyReviewForJob(jobId, user.id);
  if (existing) return existing;

  const isPoster = job.user_id === user.id;
  const isHiredWorker = job.hired_worker_id === user.id;
  if (!isPoster && !isHiredWorker) {
    throw new Error('Bạn không thuộc công việc này.');
  }

  return insertReviewRow({
    jobId,
    subjectId: isPoster ? job.hired_worker_id : job.user_id,
    reviewerId: user.id,
    rating: ratingValue,
    comment: String(comment || '').trim(),
    role: isPoster ? 'worker' : 'poster',
  });
}

function isMissingRpc(error, fnName) {
  const text = String(error?.message || error?.details || '').toLowerCase();
  const name = String(fnName || '').toLowerCase();
  return (
    error?.code === 'PGRST202' ||
    (text.includes('could not find') && text.includes(name))
  );
}

function insufficientFundsError() {
  const error = new Error('Số dư ví không đủ để gửi đề xuất');
  error.code = 'INSUFFICIENT_FUNDS';
  return error;
}

async function chargeBidFee(workerId) {
  const profile = await getProfileById(workerId);
  const balance = Number(profile?.wallet_balance) || 0;
  if (balance < BID_FEE) {
    throw insufficientFundsError();
  }

  const charged = await supabase
    .from('profiles')
    .update({ wallet_balance: balance - BID_FEE })
    .eq('id', workerId)
    .gte('wallet_balance', BID_FEE)
    .select('id, wallet_balance')
    .maybeSingle();

  if (charged.error) {
    throw new Error(charged.error.message || 'Không trừ được phí đề xuất.');
  }
  if (!charged.data?.id) {
    throw insufficientFundsError();
  }
  return charged.data;
}

async function refundBidFee(workerId) {
  const profile = await getProfileById(workerId);
  const balance = Number(profile?.wallet_balance) || 0;
  await supabase.from('profiles').update({ wallet_balance: balance + BID_FEE }).eq('id', workerId);
}

async function insertBidRow(jobId, workerId, { amount, note }) {
  const { data, error } = await supabase
    .from('bids')
    .insert({
      job_id: jobId,
      worker_id: workerId,
      proposed_price: Number(amount) || 0,
      message: note?.trim() || '',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw classifyBidError(`${error.code || ''} ${error.message || ''}`);
  }
  return data;
}

export async function createBidRecord(jobId, workerId, { amount, note }) {
  const rpc = await supabase.rpc('submit_bid', {
    p_job_id: jobId,
    p_proposed_price: Number(amount) || 0,
    p_message: note?.trim() || '',
  });

  const payload = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  if (!rpc.error && payload) {
    return payload;
  }

  if (rpc.error && !isMissingRpc(rpc.error, 'submit_bid')) {
    throw classifyBidError(rpc.error.message);
  }

  const existing = await supabase
    .from('bids')
    .select('id')
    .eq('job_id', jobId)
    .eq('worker_id', workerId)
    .maybeSingle();

  if (existing.data?.id) {
    throw classifyBidError('BID_EXISTS');
  }

  await chargeBidFee(workerId);
  try {
    return await insertBidRow(jobId, workerId, { amount, note });
  } catch (error) {
    await refundBidFee(workerId);
    throw error;
  }
}
