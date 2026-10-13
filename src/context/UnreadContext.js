import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import {
  fetchUnreadBidCounts,
  fetchUnreadMessageCounts,
  markConversationRead as markConversationReadRemote,
  markJobBidsSeen as markJobBidsSeenRemote,
  subscribeUnreadSources,
  sumCounts,
} from '@/services/unread';

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const { profile, session } = useAuth();
  const [messageUnreadByConv, setMessageUnreadByConv] = useState({});
  const [bidUnreadByJob, setBidUnreadByJob] = useState({});
  const openConversationRef = useRef(null);
  const userIdRef = useRef(profile?.id);

  useEffect(() => {
    userIdRef.current = profile?.id;
  }, [profile?.id]);

  const refresh = useCallback(async () => {
    if (!session?.user || !profile?.id) {
      setMessageUnreadByConv({});
      setBidUnreadByJob({});
      return;
    }
    const [messages, bids] = await Promise.all([
      fetchUnreadMessageCounts(),
      fetchUnreadBidCounts(),
    ]);
    setMessageUnreadByConv(messages);
    setBidUnreadByJob(bids);
  }, [profile?.id, session?.user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.user || !profile?.id) {
        await Promise.resolve();
        if (cancelled) return;
        setMessageUnreadByConv({});
        setBidUnreadByJob({});
        return;
      }
      const [messages, bids] = await Promise.all([
        fetchUnreadMessageCounts(),
        fetchUnreadBidCounts(),
      ]);
      if (cancelled) return;
      setMessageUnreadByConv(messages);
      setBidUnreadByJob(bids);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile?.id, session?.user]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!session?.user || !profile?.id) return undefined;

    return subscribeUnreadSources({
      onMessageInsert: (row) => {
        const userId = userIdRef.current;
        if (!userId || row.sender_id === userId) return;
        if (openConversationRef.current === row.conversation_id) return;
        setMessageUnreadByConv((current) => ({
          ...current,
          [row.conversation_id]: (current[row.conversation_id] || 0) + 1,
        }));
      },
      onBidInsert: () => {
        refresh().catch(() => {});
      },
      onConversationUpdate: () => {
        refresh().catch(() => {});
      },
    });
  }, [profile?.id, refresh, session?.user]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    openConversationRef.current = conversationId;
    setMessageUnreadByConv((current) => {
      if (!current[conversationId]) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    try {
      await markConversationReadRemote(conversationId);
    } catch {
      refresh().catch(() => {});
    }
  }, [refresh]);

  const setOpenConversation = useCallback((conversationId) => {
    openConversationRef.current = conversationId || null;
  }, []);

  const markJobBidsSeen = useCallback(async (jobId) => {
    if (!jobId) return 0;
    setBidUnreadByJob((current) => {
      if (!current[jobId]) return current;
      const next = { ...current };
      delete next[jobId];
      return next;
    });
    try {
      return await markJobBidsSeenRemote(jobId);
    } catch {
      refresh().catch(() => {});
      return 0;
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      messageUnreadByConv,
      bidUnreadByJob,
      messageUnreadTotal: sumCounts(messageUnreadByConv),
      bidUnreadTotal: sumCounts(bidUnreadByJob),
      refreshUnread: refresh,
      markConversationRead,
      markJobBidsSeen,
      setOpenConversation,
    }),
    [
      bidUnreadByJob,
      markConversationRead,
      markJobBidsSeen,
      messageUnreadByConv,
      refresh,
      setOpenConversation,
    ]
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread phải được dùng bên trong UnreadProvider');
  }
  return context;
}
