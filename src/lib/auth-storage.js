const memory = new Map();

const memoryStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
};

function nativeStorage() {
  try {
    const store = globalThis.localStorage;
    if (store && typeof store.getItem === 'function') return store;
  } catch {
    // Node SSR / web worker: chưa có localStorage.
  }
  return null;
}

export const authStorage = {
  getItem(key) {
    const store = nativeStorage();
    return store ? store.getItem(key) : memoryStorage.getItem(key);
  },
  setItem(key, value) {
    const store = nativeStorage();
    if (store) store.setItem(key, value);
    else memoryStorage.setItem(key, value);
  },
  removeItem(key) {
    const store = nativeStorage();
    if (store) store.removeItem(key);
    else memoryStorage.removeItem(key);
  },
};
