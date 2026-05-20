let listeners = [];
let items = [];
let unreadCount = 0;

function notify() {
  listeners.forEach((fn) => fn({ items: [...items], unreadCount }));
}

export function subscribeNotifications(fn) {
  listeners.push(fn);
  fn({ items: [...items], unreadCount });
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
  notify();
}

export function markAllRead() {
  if (unreadCount === 0) return;
  items = items.map((i) => ({ ...i, read: true }));
  unreadCount = 0;
  notify();
}

export function clearNotifications() {
  items = [];
  unreadCount = 0;
  notify();
}
