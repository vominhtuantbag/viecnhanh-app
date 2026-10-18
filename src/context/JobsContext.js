import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { JOB_STATUS, isJobLive } from '@/data/jobs';
import { subscribePostgresChanges } from '@/lib/realtime';
import {
  cancelHireRecord,
  closeJobRecord,
  completeJobRecord,
  createBidRecord,
  createJobRecord,
  fetchJobById,
  fetchJobs,
  hasWorkerBid,
  hireBidRecord,
  mapJob,
  readLocalJobs,
  recordUniqueJobView,
  writeLocalJobs,
} from '@/services/jobs';
import { mapWorkerProfile } from '@/services/profiles';

const JobsContext = createContext(null);

function isLocalProfile(profile) {
  return !profile?.id || String(profile.id).startsWith('local-');
}

export function JobsProvider({ children }) {
  const { profile, session, isComplete, refreshProfile } = useAuth();
  const [jobs, setJobs] = useState(() => readLocalJobs());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newJobsCount, setNewJobsCount] = useState(0);
  const profileRef = useRef(profile);
  const jobsRef = useRef(jobs);
  const browseFocusedRef = useRef(false);

  const bootstrap = useCallback(async () => {
    const currentProfile = profileRef.current;
    try {
      const rows = await fetchJobs();
      const mapped = (rows ?? []).map((row) => mapJob(row, currentProfile?.id));
      setJobs((current) => {
        const locals = current.filter((job) => String(job.id).startsWith('local-'));
        return [...locals, ...mapped.filter((job) => !locals.some((item) => item.id === job.id))];
      });
      setError(null);
    } catch (err) {
      setError(err.message ?? 'Không tải được danh sách việc.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    jobsRef.current = jobs;
    writeLocalJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrap();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, profile?.id]);

  const loadJob = useCallback(async (id) => {
    if (String(id).startsWith('local-')) return null;
    const row = await fetchJobById(id);
    if (!row) return null;
    const mapped = mapJob(row, profileRef.current?.id);
    setJobs((current) => {
      const exists = current.some((job) => job.id === mapped.id);
      if (exists) return current.map((job) => (job.id === mapped.id ? mapped : job));
      return [mapped, ...current];
    });
    return mapped;
  }, []);

  const noteNewLiveJob = useCallback((mapped, previous) => {
    if (!mapped || mapped.isMine || !isJobLive(mapped)) return;
    if (previous && isJobLive(previous)) return;
    if (browseFocusedRef.current) return;
    setNewJobsCount((count) => count + 1);
  }, []);

  const applyJobChange = useCallback(
    (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (!id) return;
        setJobs((current) => current.filter((job) => job.id !== id));
        return;
      }

      const row = payload.new;
      if (!row?.id) return;

      const previous = jobsRef.current.find((job) => job.id === row.id);
      const mapped = mapJob(row, profileRef.current?.id);
      setJobs((current) => {
        const exists = current.some((job) => job.id === mapped.id);
        if (exists) {
          return current.map((job) =>
            job.id === mapped.id
              ? {
                  ...job,
                  ...mapped,
                  quotes: job.quotes,
                  poster: job.poster || mapped.poster,
                }
              : job
          );
        }
        return [mapped, ...current];
      });
      noteNewLiveJob(mapped, previous);
      loadJob(row.id).catch(() => {});
    },
    [loadJob, noteNewLiveJob]
  );

  const markBrowseSeen = useCallback(() => {
    browseFocusedRef.current = true;
    setNewJobsCount(0);
  }, []);

  const markBrowseBlurred = useCallback(() => {
    browseFocusedRef.current = false;
  }, []);

  useEffect(() => {
    return subscribePostgresChanges('jobs-lifecycle', [
      {
        event: '*',
        table: 'jobs',
        callback: applyJobChange,
      },
      {
        event: '*',
        table: 'bids',
        callback: (payload) => {
          const jobId = payload.new?.job_id || payload.old?.job_id;
          if (!jobId) return;
          loadJob(jobId).catch(() => {});
        },
      },
    ]);
  }, [applyJobChange, loadJob]);

  const requireProfile = useCallback(() => {
    if (session && isComplete && profileRef.current && !isLocalProfile(profileRef.current)) {
      return profileRef.current;
    }
    const err = new Error('Vui lòng đăng nhập và hoàn tất hồ sơ để tiếp tục.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }, [isComplete, session]);

  const addJob = useCallback(async (payload) => {
    const currentProfile = requireProfile();

    try {
      const row = await createJobRecord(currentProfile.id, payload, jobsRef.current);
      const mapped = mapJob(row, currentProfile.id);
      setJobs((current) => [mapped, ...current.filter((job) => job.id !== mapped.id)]);
      setError(null);
      return mapped;
    } catch (err) {
      setError(err.message ?? 'Không đăng được tin lên server.');
      throw err;
    }
  }, [requireProfile]);

  const addQuote = useCallback(async (jobId, quote) => {
    const currentProfile = requireProfile();
    const currentJob = jobsRef.current.find((job) => job.id === String(jobId));
    if (hasWorkerBid(currentJob, currentProfile.id)) {
      const error = new Error(
        'Bạn đã gửi đề xuất cho công việc này rồi. Mỗi tin đăng chỉ được đề xuất 1 lần.'
      );
      error.code = 'BID_EXISTS';
      throw error;
    }

    if (String(jobId).startsWith('local-') || isLocalProfile(currentProfile)) {
      const bid = {
        id: `local-bid-${Date.now()}`,
        jobId: String(jobId),
        workerId: currentProfile.id,
        amount: Number(quote.amount) || 0,
        note: quote.note || '',
        status: 'pending',
        seenByPoster: false,
        worker: mapWorkerProfile(currentProfile, { id: currentProfile.id }),
      };
      setJobs((current) =>
        current.map((job) =>
          job.id === String(jobId) ? { ...job, quotes: [bid, ...(job.quotes || [])] } : job
        )
      );
      return;
    }
    await createBidRecord(jobId, currentProfile.id, quote);
    await loadJob(jobId);
    try {
      await refreshProfile();
    } catch {
      // Bid đã lưu; số dư sẽ cập nhật khi tải lại hồ sơ.
    }
  }, [loadJob, refreshProfile, requireProfile]);

  const trackJobView = useCallback(async (jobId) => {
    const viewerId = profileRef.current?.id;
    const currentJob = jobsRef.current.find((job) => job.id === String(jobId));
    if (!viewerId || isLocalProfile(profileRef.current) || String(jobId).startsWith('local-')) {
      return currentJob?.views ?? 0;
    }
    if (currentJob?.userId === viewerId) {
      return currentJob.views ?? 0;
    }

    const nextCount = await recordUniqueJobView(jobId, {
      viewerId,
      ownerId: currentJob?.userId,
    });
    if (nextCount == null) return currentJob?.views ?? 0;

    setJobs((current) =>
      current.map((job) => (job.id === String(jobId) ? { ...job, views: nextCount } : job))
    );
    return nextCount;
  }, []);

  const hireWorker = useCallback(async (jobId, bidId) => {
    requireProfile();
    if (String(jobId).startsWith('local-')) {
      setJobs((current) =>
        current.map((job) => {
          if (job.id !== String(jobId)) return job;
          return {
            ...job,
            hiredBidId: bidId,
            hiredWorkerId: (job.quotes || []).find((quote) => quote.id === bidId)?.workerId || null,
            status: JOB_STATUS.ASSIGNED,
            quotes: (job.quotes || []).map((quote) => ({
              ...quote,
              status: quote.id === bidId ? 'accepted' : 'rejected',
            })),
          };
        })
      );
      return;
    }
    await hireBidRecord(bidId);
    await loadJob(jobId);
  }, [loadJob, requireProfile]);

  const cancelHire = useCallback(async (jobId, reason) => {
    requireProfile();
    const reasonText = String(reason || '').trim();
    if (String(jobId).startsWith('local-')) {
      setJobs((current) =>
        current.map((job) => {
          if (job.id !== String(jobId)) return job;
          return {
            ...job,
            hiredBidId: null,
            hiredWorkerId: null,
            hireCancelReason: reasonText,
            status: JOB_STATUS.APPROVED,
            quotes: (job.quotes || []).map((quote) => {
              if (quote.id === job.hiredBidId || quote.workerId === job.hiredWorkerId) {
                return { ...quote, status: 'cancelled', cancelReason: reasonText };
              }
              if (quote.status === 'rejected') {
                return { ...quote, status: 'pending' };
              }
              return quote;
            }),
          };
        })
      );
      return;
    }
    await cancelHireRecord(jobId, reasonText);
    return loadJob(jobId);
  }, [loadJob, requireProfile]);

  const completeJob = useCallback(async (jobId) => {
    requireProfile();
    if (String(jobId).startsWith('local-')) {
      setJobs((current) =>
        current.map((job) =>
          job.id === String(jobId)
            ? { ...job, status: JOB_STATUS.COMPLETED, completedAt: new Date().toISOString() }
            : job
        )
      );
      return;
    }
    await completeJobRecord(jobId);
    return loadJob(jobId);
  }, [loadJob, requireProfile]);

  const closeJob = useCallback(async (jobId) => {
    requireProfile();
    if (String(jobId).startsWith('local-')) {
      setJobs((current) =>
        current.map((job) =>
          job.id === String(jobId) ? { ...job, status: JOB_STATUS.CLOSED, isApproved: false } : job
        )
      );
      return;
    }
    await closeJobRecord(jobId);
    return loadJob(jobId);
  }, [loadJob, requireProfile]);

  const value = useMemo(
    () => ({
      profile,
      jobs,
      loading,
      error,
      newJobsCount,
      markBrowseSeen,
      markBrowseBlurred,
      refreshJobs: bootstrap,
      getJobById: (id) => jobs.find((job) => job.id === String(id)) ?? null,
      loadJob,
      addJob,
      addQuote,
      hireWorker,
      cancelHire,
      completeJob,
      closeJob,
      trackJobView,
    }),
    [
      profile,
      jobs,
      loading,
      error,
      newJobsCount,
      markBrowseSeen,
      markBrowseBlurred,
      bootstrap,
      loadJob,
      addJob,
      addQuote,
      hireWorker,
      cancelHire,
      completeJob,
      closeJob,
      trackJobView,
    ]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error('useJobs phải được dùng bên trong JobsProvider');
  }
  return context;
}
