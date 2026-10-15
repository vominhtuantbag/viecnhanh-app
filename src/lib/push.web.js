const noopSub = { remove() {} };

export function isRemotePushSupported() {
  return false;
}

export function isExpoPushToken() {
  return false;
}

export function getExpoProjectId() {
  return null;
}

export async function ensurePushChannels() {}

export async function registerForPushNotifications() {
  return null;
}

export function addNotificationResponseListener() {
  return noopSub;
}

export async function getInitialPushData() {
  return null;
}

export { openFromPushData } from '@/lib/push-nav';

export function resetSyncedPushToken() {}

export async function syncUserDeviceToken() {
  return null;
}
