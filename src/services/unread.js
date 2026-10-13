import { subscribePostgresChanges } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';

function isMissingRpc(error, fnName) {
  const text = String(error?.message || error?.details || '').toLowerCase();
  const name = String(fnName || '').toLowerCase();
  return error?.code === 'PGRST202' || (text.includes('could not find') && text.includes(name));
}

function rowsToCountMap(rows, idKey) {
  const map = {};
  for (const row of rows || []) {
    const id = row?.[idKey];
    const count = Number(row?.unread_count) || 0;
    if (id && count > 0) map[id] = count;
  }
  return map;
}

async function fetchUnreadMessageCountsFallback(userId) {
  const convs = await supabase
    .from('conversations')
    .select('id, poster_id, worker_id, poster_last_read_at, worker_last_read_at')
    .or(`poster_id.eq.${userId},worker_id.eq.${userId}`);

  if (convs.error) return {};
  const rows = convs.data || [];
  const ids = rows.map((row) => row.id);
  if (!ids.length) return {};

  const messages = await supabase
    .from('messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', ids);

  if (messages.error) return {};

  const lastReadByConv = {};
  for (const row of rows) {
    lastReadByConv[row.id] =
      row.poster_id === userId ? row.poster_last_read_at : row.worker_last_read_at;
  }

  const map = {};
  for (const message of messages.data || []) {
    if (message.sender_id === userId) continue;
    const lastRead = lastReadByConv[message.conversation_id];
    if (lastRead && new Date(message.created_at) <= new Date(lastRead)) continue;
    map[message.conversation_id] = (map[message.conversation_id] || 0) + 1;
  }
  return map;
}

async function fetchUnreadBidCountsFallback(userId) {
  const jobs = await supabase.from('jobs').select('id').eq('user_id', userId);
  if (jobs.error) return {};
  const jobIds = (jobs.data || []).map((row) => row.id);
  if (!jobIds.length) return {};

  const bids = await supabase
    .from('bids')
    .select('job_id, seen_by_poster_at')
    .in('job_id', jobIds)
    .is('seen_by_poster_at', null);

  if (bids.error) return {};

  const map = {};
  for (const bid of bids.data || []) {
    if (!bid.job_id) continue;
    map[bid.job_id] = (map[bid.job_id] || 0) + 1;
  }
  return map;
}

export async function fetchUnreadMessageCounts() {
  const rpc = await supabase.rpc('fetch_unread_message_counts');
  if (!rpc.error) {
    return rowsToCountMap(rpc.data, 'conversation_id');
  }
  if (!isMissingRpc(rpc.error, 'fetch_unread_message_counts')) {
    return {};
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return {};
  return fetchUnreadMessageCountsFallback(user.id);
}

export async function fetchUnreadBidCounts() {
  const rpc = await supabase.rpc('fetch_unread_bid_counts');
  if (!rpc.error) {
    return rowsToCountMap(rpc.data, 'job_id');
  }
  if (!isMissingRpc(rpc.error, 'fetch_unread_bid_counts')) {
    return {};
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return {};
  return fetchUnreadBidCountsFallback(user.id);
}

export async function markConversationRead(conversationId) {
  if (!conversationId) return;
  const rpc = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (!rpc.error) return;

  if (!isMissingRpc(rpc.error, 'mark_conversation_read')) {
    throw new Error(rpc.error.message || 'Không đánh dấu đã đọc được.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  const conv = await supabase
    .from('conversations')
    .select('poster_id, worker_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv.data) return;

  const field = conv.data.poster_id === user.id ? 'poster_last_read_at' : 'worker_last_read_at';
  await supabase
    .from('conversations')
    .update({ [field]: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function markJobBidsSeen(jobId) {
  if (!jobId || String(jobId).startsWith('local-')) return 0;
  const rpc = await supabase.rpc('mark_job_bids_seen', { p_job_id: jobId });
  if (!rpc.error) return Number(rpc.data) || 0;

  if (!isMissingRpc(rpc.error, 'mark_job_bids_seen')) {
    throw new Error(rpc.error.message || 'Không đánh dấu đề xuất đã xem.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return 0;

  const job = await supabase.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
  if (job.data?.user_id !== user.id) return 0;

  const updated = await supabase
    .from('bids')
    .update({ seen_by_poster_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .is('seen_by_poster_at', null)
    .select('id');

  return updated.data?.length || 0;
}

export function subscribeUnreadSources({ onMessageInsert, onBidInsert, onConversationUpdate }) {
  return subscribePostgresChanges('unread-badges', [
    {
      event: 'INSERT',
      table: 'messages',
      callback: (payload) => {
        if (payload.new) onMessageInsert?.(payload.new);
      },
    },
    {
      event: 'INSERT',
      table: 'bids',
      callback: (payload) => {
        if (payload.new) onBidInsert?.(payload.new);
      },
    },
    {
      event: 'UPDATE',
      table: 'conversations',
      callback: (payload) => {
        if (payload.new) onConversationUpdate?.(payload.new);
      },
    },
  ]);
}

export function sumCounts(map) {
  return Object.values(map || {}).reduce((total, value) => total + (Number(value) || 0), 0);
}

export function badgeLabel(count) {
  const value = Number(count) || 0;
  if (value <= 0) return undefined;
  if (value > 99) return '99+';
  return value;
}
