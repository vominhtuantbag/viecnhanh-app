import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useJobs } from '@/context/JobsContext';
import { JOB_STATUS, jobFlowStatus } from '@/data/jobs';
import { fetchConversationByJobAndWorker } from '@/services/chat';
import { fetchMyReviewForJob } from '@/services/jobs';

export default function PendingReviewGate() {
  const { profile } = useAuth();
  const { jobs } = useJobs();
  const pathname = usePathname();
  const promptedRef = useRef(new Set());
  const openingRef = useRef(false);

  useEffect(() => {
    if (!profile?.id || openingRef.current) return undefined;

    const pending = jobs.find((job) => {
      if (jobFlowStatus(job) !== JOB_STATUS.COMPLETED) return false;
      if (job.hiredWorkerId !== profile.id) return false;
      if (promptedRef.current.has(job.id)) return false;
      if (job.completedAt) {
        const age = Date.now() - new Date(job.completedAt).getTime();
        if (Number.isFinite(age) && age > 48 * 60 * 60 * 1000) return false;
      }
      return true;
    });
    if (!pending) return undefined;

    let cancelled = false;
    openingRef.current = true;
    promptedRef.current.add(pending.id);

    (async () => {
      try {
        const existing = await fetchMyReviewForJob(pending.id, profile.id);
        if (cancelled || existing) return;
        const conversation = await fetchConversationByJobAndWorker(pending.id, profile.id);
        if (cancelled || !conversation?.id) return;
        if (pathname?.includes(`/chat/`) && String(pathname).includes(String(conversation.id))) {
          return;
        }
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: String(conversation.id),
            jobId: String(pending.id),
            workerId: String(profile.id),
            review: '1',
          },
        });
      } catch {
        promptedRef.current.delete(pending.id);
      } finally {
        openingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobs, pathname, profile?.id]);

  return null;
}
