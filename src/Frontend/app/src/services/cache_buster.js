// Auto cache-buster for Expo web. Unregisters any service workers and
// drops the browser HTTP cache for our origin so stale bundles never stick.

import { Platform } from 'react-native';

let purged = false;

export async function purgeWebCaches() {
  if (Platform.OS !== 'web' || purged) return;
  purged = true;

  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => {})));
    }
  } catch (_) { /* ignore */ }

  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
    }
  } catch (_) { /* ignore */ }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('ssp.lastError');
    }
  } catch (_) { /* ignore */ }
}
