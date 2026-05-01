let listeners = [];
let activeRequests = 0;

export function subscribeLoading(fn) {
  listeners.push(fn);
  fn(activeRequests > 0);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function incrementLoading() {
  activeRequests++;
  if (activeRequests === 1) notify();
}

export function decrementLoading() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) notify();
}

function notify() {
  const isLoading = activeRequests > 0;
  listeners.forEach(fn => fn(isLoading));
}
