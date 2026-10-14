import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';

import { PUSH_CHANNELS, PUSH_GROUPS } from '@/constants/notifications';
import { upsertPushToken } from '@/services/notifications';
import { supabase } from '@/lib/supabase';

const noopSub = { remove() {} };
let Notifications = null;
let notificationsTried = false;

function isExpoGo() {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

export function isRemotePushSupported() {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;
  if (isExpoGo()) return false;
  return true;
}

function warnPush(message, err) {
  const detail = err?.message || err;
  console.warn('[Việc Nhanh][Push]', message, detail ? detail : '');
}

function getNotifications() {
  if (!isRemotePushSupported()) return null;
  if (notificationsTried) return Notifications;
  notificationsTried = true;
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    warnPush('Bỏ qua notification handler (Expo Go / thiếu native module).', err);
    Notifications = null;
  }
  return Notifications;
}

export function isExpoPushToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

export function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    null
  );
}

export async function ensurePushChannels() {
  const module = getNotifications();
  if (!module || Platform.OS !== 'android') return;

  const channels = [
    {
      id: PUSH_CHANNELS.listing,
      name: 'Cập nhật tin đăng',
      description: 'Đề xuất, tin nhắn, thuê thợ, hủy thuê và đánh giá.',
    },
    {
      id: PUSH_CHANNELS.wallet,
      name: 'Ví Việc Nhanh',
      description: 'Biến động số dư ví.',
    },
    {
      id: PUSH_CHANNELS.jobs,
      name: 'Việc làm mới',
      description: 'Tin đăng mới theo khu vực và danh mục bạn chọn.',
    },
    {
      id: PUSH_CHANNELS.promo,
      name: 'Khuyến mãi & mẹo vặt',
      description: 'Ưu đãi, mẹo sử dụng ứng dụng.',
    },
  ];

  try {
    await Promise.all(
      channels.map((channel) =>
        module.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          description: channel.description,
          importance: module.AndroidImportance.HIGH,
          vibrationPattern: [0, 220, 120, 220],
          lightColor: '#0052FF',
          showBadge: true,
        })
      )
    );
  } catch (err) {
    warnPush('Không tạo được kênh thông báo Android.', err);
  }
}

export async function registerForPushNotifications() {
  if (!isRemotePushSupported()) {
    if (isExpoGo()) {
      warnPush('Expo Go không hỗ trợ push token dự án. Dùng bản cài APK/development build.');
    } else if (!Device.isDevice) {
      warnPush('Máy ảo/web không lấy được Expo Push Token.');
    }
    return null;
  }

  const module = getNotifications();
  if (!module) return null;

  try {
    await ensurePushChannels();

    const existing = await module.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await module.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') {
      warnPush('Người dùng chưa cấp quyền thông báo.');
      return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      warnPush('Thiếu EAS projectId, không lấy được Expo Push Token.');
      return null;
    }

    const tokenResponse = await module.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse?.data || null;
    if (!isExpoPushToken(token)) {
      warnPush('Expo Push Token không hợp lệ.', token);
      return null;
    }
    return token;
  } catch (err) {
    warnPush('Bỏ qua đăng ký push để app không bị sập.', err);
    return null;
  }
}

export function addNotificationResponseListener(handler) {
  try {
    const module = getNotifications();
    if (!module) return noopSub;
    return module.addNotificationResponseReceivedListener((response) => {
      handler(response?.notification?.request?.content?.data);
    });
  } catch (err) {
    warnPush('Không gắn được listener bấm thông báo.', err);
    return noopSub;
  }
}

export async function getInitialPushData() {
  try {
    const module = getNotifications();
    if (!module) return null;
    const response = await module.getLastNotificationResponseAsync();
    return response?.notification?.request?.content?.data || null;
  } catch (err) {
    warnPush('Không đọc được thông báo mở app.', err);
    return null;
  }
}

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

let syncInFlight = null;
let lastSynced = { userId: null, token: null };

export function resetSyncedPushToken() {
  lastSynced = { userId: null, token: null };
}

export async function syncUserDeviceToken(userId) {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const token = await registerForPushNotifications();
      if (!token) return null;

      let uid = userId;
      if (!uid) {
        const { data } = await supabase.auth.getUser();
        uid = data?.user?.id;
      }
      if (!uid) return token;
      if (lastSynced.userId === uid && lastSynced.token === token) return token;

      await upsertPushToken(uid, token);
      lastSynced = { userId: uid, token };
      return token;
    } catch (err) {
      warnPush('Không lưu được push token.', err);
      return null;
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
