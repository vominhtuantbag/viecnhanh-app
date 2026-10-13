import '@/lib/sqlite-storage';

const MESSAGE_PREFIX = 'viecnhanh_chat_messages_';
const CONVERSATION_PREFIX = 'viecnhanh_chat_conversation_';

function storage() {
  try {
    const store = globalThis.localStorage;
    if (store && typeof store.getItem === 'function') return store;
  } catch {
    // Node SSR / web private mode / native before polyfill.
  }
  return null;
}

function readJson(key) {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / serialization errors.
  }
}

export function mergeMessages(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      if (!item?.id) continue;
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function readCachedMessages(conversationId) {
  if (!conversationId) return [];
  const rows = readJson(`${MESSAGE_PREFIX}${conversationId}`);
  return Array.isArray(rows) ? rows : [];
}

export function writeCachedMessages(conversationId, messages) {
  if (!conversationId) return;
  writeJson(`${MESSAGE_PREFIX}${conversationId}`, mergeMessages(messages));
}

export function readCachedConversation(conversationId) {
  if (!conversationId) return null;
  return readJson(`${CONVERSATION_PREFIX}${conversationId}`);
}

export function writeCachedConversation(conversationId, row) {
  if (!conversationId || !row) return;
  writeJson(`${CONVERSATION_PREFIX}${conversationId}`, row);
}
