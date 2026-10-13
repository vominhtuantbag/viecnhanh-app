import { Platform } from 'react-native';

import { NOTIFY_DEFAULTS } from '@/constants/notifications';
import { supabase, unwrap } from '@/lib/supabase';

const NOTIFY_KEYS = Object.keys(NOTIFY_DEFAULTS);

export function mapNotifyPrefs(profile) {
  const prefs = {};
  for (const key of NOTIFY_KEYS) {
    prefs[key] = profile?.[key] == null ? NOTIFY_DEFAULTS[key] : Boolean(profile[key]);
  }
  return prefs;
}

export async function saveNotifyPrefs(userId, prefs) {
  const row = {};
  for (const key of NOTIFY_KEYS) {
    if (prefs[key] !== undefined) {
      row[key] = Boolean(prefs[key]);
    }
  }
  return unwrap(await supabase.from('profiles').update(row).eq('id', userId).select().single());
}

export function mapJobAlertSettings(row, userId) {
  return {
    userId: row?.user_id || userId || null,
    categoryIds: Array.isArray(row?.category_ids) ? row.category_ids.filter(Boolean) : [],
    provinceId: row?.province_id || '',
    wardIds: Array.isArray(row?.ward_ids) ? row.ward_ids.filter(Boolean) : [],
  };
}

export async function fetchJobAlertSettings(userId) {
  if (!userId) return mapJobAlertSettings(null);
  const row = unwrap(
    await supabase.from('job_alert_settings').select('*').eq('user_id', userId).maybeSingle()
  );
  return mapJobAlertSettings(row, userId);
}

export async function saveJobAlertSettings(userId, payload) {
  const categoryIds = [...new Set((payload.categoryIds || []).filter(Boolean))];
  const provinceId = payload.provinceId || null;
  const wardIds = provinceId
    ? [...new Set((payload.wardIds || []).filter(Boolean))]
    : [];

  return mapJobAlertSettings(
    unwrap(
      await supabase
        .from('job_alert_settings')
        .upsert(
          {
            user_id: userId,
            category_ids: categoryIds,
            province_id: provinceId,
            ward_ids: wardIds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single()
    ),
    userId
  );
}

export async function upsertPushToken(userId, token) {
  if (!userId || !token) return null;

  const platform = Platform.OS || 'unknown';
  const rpc = await supabase.rpc('upsert_device_push_token', {
    p_token: token,
    p_platform: platform,
  });
  if (!rpc.error) return { user_id: userId, token, platform };

  const updated = await supabase
    .from('device_push_tokens')
    .update({
      user_id: userId,
      platform,
      updated_at: new Date().toISOString(),
    })
    .eq('token', token)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (!updated.error && updated.data) return updated.data;

  const inserted = await supabase
    .from('device_push_tokens')
    .insert({
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (!inserted.error) return inserted.data;
  if (inserted.error.code === '23505') {
    const existing = await supabase
      .from('device_push_tokens')
      .select('*')
      .eq('token', token)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing.data) return existing.data;
  }

  throw new Error(rpc.error.message || inserted.error.message || 'Không lưu được push token.');
}

export async function removePushToken(token) {
  if (!token) return;
  await supabase.from('device_push_tokens').delete().eq('token', token);
}
