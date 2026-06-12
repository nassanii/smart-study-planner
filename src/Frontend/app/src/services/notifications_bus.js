import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'smart-study.in-app-notifications.v1';

let listeners = [];
let items = [];
let unreadCount = 0;
let hasHydrated = false;
let hydratePromise = null;
let currentScope = 'anonymous';

const getStorageKey = () => `${STORAGE_KEY_PREFIX}:${currentScope || 'anonymous'}`;

function notify() {
  listeners.forEach((fn) => fn({ items: [...items], unreadCount }));
}

function normalizeStored(payload) {
  if (!payload || !Array.isArray(payload.items)) {
    return { items: [], unreadCount: 0 };
  }

  const nextItems = payload.items
    .filter((item) => item && item.id && item.title)
    .slice(0, 50)
    .map((item) => ({
      id: String(item.id),
      title: String(item.title),
      body: item.body ? String(item.body) : '',
      createdAt: item.createdAt || new Date().toISOString(),
      read: !!item.read,
    }));

  return {
    items: nextItems,
    unreadCount: nextItems.filter((item) => !item.read).length,
  };
}

function mergeNotificationItems(primary, secondary) {
  const seen = new Set();
  return [...primary, ...secondary]
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}

function persistNotifications() {
  AsyncStorage
    .setItem(getStorageKey(), JSON.stringify({ items, unreadCount }))
    .catch(() => {});
}

export function hydrateNotifications() {
  if (hasHydrated) return Promise.resolve({ items: [...items], unreadCount });
  if (!hydratePromise) {
    const storageKey = getStorageKey();
    hydratePromise = AsyncStorage
      .getItem(storageKey)
      .then((raw) => {
        if (storageKey !== getStorageKey()) return;
        if (raw) {
          const stored = normalizeStored(JSON.parse(raw));
          items = mergeNotificationItems(items, stored.items);
          unreadCount = items.filter((item) => !item.read).length;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (storageKey !== getStorageKey()) return;
        hasHydrated = true;
        hydratePromise = null;
        notify();
      });
  }
  return hydratePromise;
}

hydrateNotifications();

export function setNotificationUserScope(scope) {
  const nextScope = scope ? `user:${scope}` : 'anonymous';
  if (currentScope === nextScope && hasHydrated) {
    return hydrateNotifications();
  }

  currentScope = nextScope;
  items = [];
  unreadCount = 0;
  hasHydrated = false;
  hydratePromise = null;
  notify();
  return hydrateNotifications();
}

export function subscribeNotifications(fn) {
  listeners.push(fn);
  fn({ items: [...items], unreadCount });
  hydrateNotifications();
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function pushNotification(title, body) {
  const item = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  };
  items = [item, ...items].slice(0, 50);
  unreadCount += 1;
  persistNotifications();
  notify();
}

export function markAllRead() {
  if (unreadCount === 0) return;
  items = items.map((i) => ({ ...i, read: true }));
  unreadCount = 0;
  persistNotifications();
  notify();
}

export function clearNotifications() {
  items = [];
  unreadCount = 0;
  persistNotifications();
  notify();
}
