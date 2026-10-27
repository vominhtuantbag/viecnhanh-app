import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { ensureAuthProfile } from '@/services/profiles';

const DEVICE_KEY = 'viecnhanh.device-id';
const ACTIVE_USER_KEY = 'viecnhanh.active-user-id';

export const OTHER_DEVICE_MESSAGE = 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác.';

let deviceIdPromise = null;
let replacedCheck = null;
let rememberedUserId = null;

function createDeviceId() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `vn-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function missingDeviceColumn(error) {
  return /current_device_id|schema cache|42703/i.test(error?.message || '');
}

export function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      const existing = await AsyncStorage.getItem(DEVICE_KEY);
      if (existing) return existing;
      const created = createDeviceId();
      await AsyncStorage.setItem(DEVICE_KEY, created);
      return created;
    })().catch((error) => {
      deviceIdPromise = null;
      throw error;
    });
  }
  return deviceIdPromise;
}

async function rememberActiveUser(userId) {
  if (!userId || rememberedUserId === userId) return;
  await AsyncStorage.setItem(ACTIVE_USER_KEY, userId);
  rememberedUserId = userId;
}

export async function forgetActiveUser() {
  rememberedUserId = null;
  await AsyncStorage.removeItem(ACTIVE_USER_KEY);
}

async function readActiveDeviceId(userId) {
  const result = await supabase
    .from('profiles')
    .select('current_device_id')
    .eq('id', userId)
    .maybeSingle();

  if (result.error) {
    if (missingDeviceColumn(result.error)) return { supported: false, deviceId: null };
    throw new Error(result.error.message || 'Không kiểm tra được phiên đăng nhập.');
  }

  return { supported: true, deviceId: result.data?.current_device_id || null };
}

async function claimDevice(userId, deviceId) {
  const saved = await supabase
    .from('profiles')
    .update({ current_device_id: deviceId })
    .eq('id', userId)
    .select('current_device_id')
    .maybeSingle();

  if (saved.error) {
    if (missingDeviceColumn(saved.error)) return { supported: false, deviceId };
    throw new Error(saved.error.message || 'Không lưu được thiết bị đăng nhập.');
  }

  const revoked = await supabase.auth.signOut({ scope: 'others' });
  if (revoked.error) {
    console.log('Không thu hồi được phiên cũ:', revoked.error.message);
  }

  await rememberActiveUser(userId);
  return { supported: true, deviceId };
}

export async function enforceSingleDevice(user, { takeover = false } = {}) {
  const userId = user?.id;
  if (!userId) return { ok: true, supported: false, deviceId: null };

  const deviceId = await getDeviceId();
  if (takeover) {
    try {
      await ensureAuthProfile(user);
    } catch (error) {
      console.log('Không tạo được hồ sơ trước khi gắn thiết bị:', error?.message || error);
    }
  }

  const active = await readActiveDeviceId(userId);
  if (!active.supported) return { ok: true, supported: false, deviceId };

  if (takeover || !active.deviceId) {
    const claimed = await claimDevice(userId, deviceId);
    return { ok: true, supported: claimed.supported, deviceId };
  }

  if (active.deviceId !== deviceId) {
    return { ok: false, supported: true, deviceId };
  }

  await rememberActiveUser(userId);
  return { ok: true, supported: true, deviceId };
}

export function takeReplacedLoginNotice() {
  if (!replacedCheck) {
    replacedCheck = (async () => {
      const userId = await AsyncStorage.getItem(ACTIVE_USER_KEY);
      if (!userId) return false;
      const deviceId = await getDeviceId();
      const active = await readActiveDeviceId(userId);
      if (!active.supported || !active.deviceId || active.deviceId === deviceId) return false;
      await forgetActiveUser();
      return true;
    })().finally(() => {
      replacedCheck = null;
    });
  }
  return replacedCheck;
}
