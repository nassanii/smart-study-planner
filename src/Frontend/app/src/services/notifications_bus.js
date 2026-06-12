import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'smart-study.in-app-notifications.v1';

let listeners = [];
let items = [];
let unreadCount = 0;
let hasHydrated = false;
let hydratePromise = null;

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

function persistNotifications() {
  AsyncStorage
    .setItem(STORAGE_KEY, JSON.stringify({ items, unreadCount }))
    .catch(() => {});
}

export function hydrateNotifications() {
  if (hasHydrated) return Promise.resolve({ items: [...items], unreadCount });
  if (!hydratePromise) {
    hydratePromise = AsyncStorage
      .getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const stored = normalizeStored(JSON.parse(raw));
          items = stored.items;
          unreadCount = stored.unreadCount;
        }
      })
      .catch(() => {})
      .finally(() => {
        hasHydrated = true;
        hydratePromise = null;
        notify();
      });
  }
  return hydratePromise;
}

hydrateNotifications();

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
