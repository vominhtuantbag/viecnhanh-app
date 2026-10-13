import {
  mergeMessages,
  readCachedConversation,
  readCachedMessages,
  writeCachedConversation,
  writeCachedMessages,
} from '@/lib/chat-cache';
import { supabase, unwrap } from '@/lib/supabase';
import { mapWorkerProfile } from '@/services/profiles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONVERSATION_SELECT = `
  *,
  job:jobs!job_id(*),
  bid:bids!bid_id(*),
  poster:profiles!poster_id(*),
  worker:profiles!worker_id(*)
`;

export function asConversationId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return UUID_RE.test(trimmed) ? trimmed : null;
  }
  if (Array.isArray(value)) return asConversationId(value[0]);
  if (typeof value === 'object') {
    return asConversationId(value.id || value.conversation_id || value.conversationId);
  }
  return null;
}

async function attachConversationRelations(row) {
  if (!row) return null;
  if (row.poster && row.worker) return row;

  const ids = [row.poster_id, row.worker_id].filter(Boolean);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  const profileMap = Object.fromEntries((profiles || []).map((item) => [item.id, item]));
  const job = row.job
    ? { data: row.job }
    : await supabase.from('jobs').select('*').eq('id', row.job_id).maybeSingle();
  const bid = row.bid
    ? { data: row.bid }
    : await supabase.from('bids').select('*').eq('id', row.bid_id).maybeSingle();

  return {
    ...row,
    poster: row.poster || profileMap[row.poster_id] || null,
    worker: row.worker || profileMap[row.worker_id] || null,
    job: job.data || row.job || null,
    bid: bid.data || row.bid || null,
  };
}

export function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body || '',
    kind: row.kind || 'text',
    createdAt: row.created_at,
  };
}

export function mapConversation(row, profileId) {
  const posters = row.poster || {};
  const workers = row.worker || {};
  return {
    id: row.id,
    jobId: row.job_id,
    bidId: row.bid_id,
    posterId: row.poster_id,
    workerId: row.worker_id,
    createdAt: row.created_at,
    job: row.job
      ? {
          id: row.job.id,
          title: row.job.title,
          userId: row.job.user_id,
          hiredWorkerId: row.job.hired_worker_id || null,
          hiredBidId: row.job.hired_bid_id || null,
          status: row.job.status || null,
          isApproved: Boolean(row.job.is_approved),
        }
      : null,
    bid: row.bid
      ? {
          id: row.bid.id,
          amount: Number(row.bid.proposed_price) || 0,
          status: row.bid.status,
          note: row.bid.message || '',
        }
      : null,
    poster: mapWorkerProfile(posters, { id: row.poster_id }),
    worker: mapWorkerProfile(workers, { id: row.worker_id }),
    lastMessage: row.lastMessage || null,
    isPoster: Boolean(profileId && row.poster_id === profileId),
  };
}

export function otherParty(conversation, profileId) {
  if (!conversation) return null;
  return conversation.posterId === profileId ? conversation.worker : conversation.poster;
}

export function peerIdOf(conversation, profileId) {
  if (!conversation || !profileId) return conversation?.id || null;
  return conversation.posterId === profileId ? conversation.workerId : conversation.posterId;
}

export function groupConversationsByPeer(conversations, profileId) {
  const groups = new Map();
  for (const item of conversations || []) {
    const key = peerIdOf(item, profileId) || item.id;
    const time = new Date(item.lastMessage?.createdAt || item.createdAt || 0).getTime();
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: key,
        peerId: key,
        conversations: [item],
        latest: item,
        latestTime: time,
      });
      continue;
    }
    existing.conversations.push(item);
    if (time > existing.latestTime) {
      existing.latest = item;
      existing.latestTime = time;
    }
  }
  return [...groups.values()].sort((a, b) => b.latestTime - a.latestTime);
}

export function posterHasMessaged(messages, posterId) {
  return (messages || []).some(
    (item) => item.senderId === posterId && item.kind !== 'system'
  );
}

async function loadConversationRow(applyFilters) {
  const nested = await applyFilters(
    supabase.from('conversations').select(CONVERSATION_SELECT)
  ).maybeSingle();
  if (!nested.error) {
    return attachConversationRelations(nested.data);
  }
  const plain = await applyFilters(supabase.from('conversations').select('*')).maybeSingle();
  if (plain.error) {
    throw new Error(plain.error.message || nested.error.message || 'Không tải được cuộc trò chuyện.');
  }
  return attachConversationRelations(plain.data);
}

function cacheConversation(row) {
  if (row?.id) writeCachedConversation(row.id, row);
  return row;
}

export async function fetchConversationByJobAndWorker(jobId, workerId) {
  if (!jobId || !workerId) return null;
  const row = await loadConversationRow((query) =>
    query.eq('job_id', jobId).eq('worker_id', workerId)
  );
  return cacheConversation(row);
}

export async function fetchConversationById(id) {
  const conversationId = asConversationId(id);
  if (!conversationId) return null;
  try {
    const row = await loadConversationRow((query) => query.eq('id', conversationId));
    return cacheConversation(row);
  } catch (error) {
    const cached = readCachedConversation(conversationId);
    if (cached) return cached;
    throw error;
  }
}

async function hydrateConversation(rowOrId) {
  const conversationId = asConversationId(rowOrId);
  if (conversationId) {
    try {
      const fetched = await fetchConversationById(conversationId);
      if (fetched) return fetched;
    } catch {
      // Dùng row RPC thô nếu select embed bị lỗi.
    }
  }
  if (rowOrId && typeof rowOrId === 'object' && rowOrId.job_id) {
    return attachConversationRelations(rowOrId);
  }
  return null;
}

export async function getOrCreateConversation(jobId, workerId) {
  const rpc = await supabase.rpc('get_or_create_conversation', {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (!rpc.error && rpc.data) {
    const created = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const hydrated = await hydrateConversation(created);
    if (hydrated) return cacheConversation(hydrated);
  }

  const existing = await fetchConversationByJobAndWorker(jobId, workerId);
  if (existing) return existing;

  const job = unwrap(await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle());
  const bid = unwrap(
    await supabase
      .from('bids')
      .select('*')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle()
  );
  if (!job || !bid) {
    throw new Error(rpc.error?.message || 'Không mở được cuộc trò chuyện.');
  }

  const inserted = await supabase
    .from('conversations')
    .insert({
      job_id: jobId,
      bid_id: bid.id,
      poster_id: job.user_id,
      worker_id: workerId,
    })
    .select('*')
    .single();

  if (inserted.error) {
    const raced = await fetchConversationByJobAndWorker(jobId, workerId);
    if (raced) return raced;
    throw new Error(rpc.error?.message || inserted.error.message || 'Không mở được cuộc trò chuyện.');
  }

  return cacheConversation(await hydrateConversation(inserted.data));
}

async function listConversationRowsForUser(userId) {
  const rpc = await supabase.rpc('fetch_my_conversations');
  if (!rpc.error) {
    return rpc.data || [];
  }

  const [posterRes, workerRes] = await Promise.all([
    supabase.from('conversations').select('*').eq('poster_id', userId).order('created_at', { ascending: false }),
    supabase.from('conversations').select('*').eq('worker_id', userId).order('created_at', { ascending: false }),
  ]);

  if (posterRes.error && workerRes.error) {
    throw new Error(posterRes.error.message || workerRes.error.message || 'Không tải được tin nhắn.');
  }

  const merged = new Map();
  for (const row of [...(posterRes.data || []), ...(workerRes.data || [])]) {
    if (row?.id) merged.set(row.id, row);
  }
  return [...merged.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function fetchConversationsForUser(userId) {
  if (!userId) return [];

  const rawRows = await listConversationRowsForUser(userId);
  const rows = await Promise.all((rawRows || []).map(attachConversationRelations));
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return [];

  const messagesResult = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false });

  const latest = {};
  for (const message of messagesResult.data || []) {
    if (!latest[message.conversation_id]) {
      latest[message.conversation_id] = mapMessage(message);
    }
  }

  return rows.map((row) => ({
    ...row,
    lastMessage: latest[row.id] || null,
  }));
}

export async function fetchMessages(conversationId) {
  if (!conversationId) return [];
  const cached = readCachedMessages(conversationId);

  try {
    const rpc = await supabase.rpc('fetch_chat_messages', {
      p_conversation_id: conversationId,
    });
    if (!rpc.error) {
      const mapped = (rpc.data || []).map(mapMessage);
      const merged = mergeMessages(cached, mapped);
      writeCachedMessages(conversationId, merged);
      return merged;
    }

    const rows = unwrap(
      await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
    );
    const mapped = (rows || []).map(mapMessage);
    const merged = mergeMessages(cached, mapped);
    writeCachedMessages(conversationId, merged);
    return merged;
  } catch (error) {
    if (cached.length) return cached;
    throw error;
  }
}

export async function sendChatMessage(conversationId, body, kind = 'text') {
  const trimmed = String(body || '').trim();
  if (!trimmed) {
    throw new Error('Nhập nội dung tin nhắn.');
  }

  const rpc = await supabase.rpc('send_chat_message', {
    p_conversation_id: conversationId,
    p_body: trimmed,
    p_kind: kind,
  });
  if (!rpc.error && rpc.data) {
    const mapped = mapMessage(Array.isArray(rpc.data) ? rpc.data[0] : rpc.data);
    writeCachedMessages(conversationId, mergeMessages(readCachedMessages(conversationId), [mapped]));
    return mapped;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Cần đăng nhập để gửi tin nhắn.');
  }

  const conversation = await fetchConversationById(conversationId);
  if (!conversation) {
    throw new Error(rpc.error?.message || 'Không tìm thấy cuộc trò chuyện.');
  }
  if (kind === 'phone_share' && user.id !== conversation.poster_id) {
    throw new Error('Chỉ người đăng tin mới gửi số điện thoại.');
  }
  if (user.id === conversation.worker_id) {
    const prior = await fetchMessages(conversationId);
    if (!posterHasMessaged(prior, conversation.poster_id)) {
      throw new Error(
        'Người đăng tin phải gửi tin nhắn đầu tiên. Sau đó bạn mới có thể trả lời.'
      );
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
      kind,
    })
    .select()
    .single();

  if (error) {
    throw new Error(rpc.error?.message || error.message || 'Không gửi được tin nhắn.');
  }
  const mapped = mapMessage(data);
  writeCachedMessages(conversationId, mergeMessages(readCachedMessages(conversationId), [mapped]));
  return mapped;
}

export function subscribeMessages(conversationId, onInsert) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new) onInsert(mapMessage(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
