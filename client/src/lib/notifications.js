import { api } from './api.js';

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
export const notificationPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('Service worker registration failed', e);
    return null;
  }
}

const urlBase64ToUint8Array = (b64) => {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  if (!import.meta.env.PROD) return null; // the service worker only runs in production builds
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  try {
    const reg = await getRegistration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

// Asks for permission, subscribes this device and tells the server about it.
export async function enablePush() {
  if (!notificationsSupported()) throw new Error('This browser does not support notifications. On iPhone, add Docket to your Home Screen first.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your phone or browser settings for this site.');
  const reg = await getRegistration();
  if (!reg) throw new Error('The app is still starting. Try again in a moment.');
  const { key } = await api.get('/push/public-key');
  if (!key) throw new Error('The server has no push keys yet. See the README, step "Notifications".');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await api.post('/push/subscribe', { subscription: sub.toJSON() });
  return true;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
}

// Shows a notification through the service worker (works on Android, needed on iOS home-screen apps).
export async function showLocalNotification(title, body, tag) {
  if (notificationPermission() !== 'granted') return false;
  try {
    const reg = await getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: '/tasks' } });
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    return true;
  } catch {
    return false;
  }
}
