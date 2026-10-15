import { Linking } from 'react-native';
import { router } from 'expo-router';

import { PUSH_GROUPS } from '@/constants/notifications';

function toAppPath(raw) {
  const value = String(raw || '').trim();
  if (!value || /^https?:\/\//i.test(value)) return '';
  const [pathname, search = ''] = (value.startsWith('/') ? value : `/${value}`).split('?');
  const query = search ? `?${search}` : '';
  if (pathname === '/rewards' || pathname === '/promotions' || pathname === '/quests') {
    return `/settings/quests${query}`;
  }
  if (pathname === '/browse' || pathname === '/home') return `/(tabs)/browse${query}`;
  if (pathname === '/messages') return `/(tabs)/messages${query}`;
  if (pathname === '/account') return `/(tabs)/account${query}`;
  if (pathname === '/payments' || pathname === '/wallet') return `/settings/payments${query}`;
  const jobMatch = pathname.match(/^\/jobs\/([^/]+)/);
  if (jobMatch) return `/job/${jobMatch[1]}${query}`;
  return `${pathname}${query}`;
}

function openPushLink(link) {
  const value = String(link || '').trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) {
    Linking.openURL(value).catch(() => {});
    return true;
  }
  const path = toAppPath(value);
  if (!path) return false;
  try {
    router.push(path);
    return true;
  } catch {
    return false;
  }
}

export function openFromPushData(data) {
  const payload = data || {};
  const screen = String(payload.screen || '');
  const group = String(payload.group || '');

  if (screen === 'job' && payload.jobId) {
    router.push(`/job/${payload.jobId}`);
    return;
  }
  if (screen === 'chat' && payload.conversationId) {
    router.push(`/chat/${payload.conversationId}`);
    return;
  }
  if (screen === 'user' && payload.userId) {
    router.push(`/user/${payload.userId}`);
    return;
  }
  if (screen === 'payments' || group === PUSH_GROUPS.wallet) {
    router.push('/settings/payments');
    return;
  }
  if (screen === 'link' || payload.url || payload.path) {
    if (openPushLink(payload.url || payload.path)) return;
  }
  if (group === PUSH_GROUPS.jobs) {
    router.push('/(tabs)/browse');
    return;
  }
  if (group === PUSH_GROUPS.listing) {
    router.push('/(tabs)/my-tasks');
  }
}
