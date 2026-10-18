import { Platform } from 'react-native';
import * as Location from 'expo-location';

import { areaFromCoordinates } from '@/services/geo';
import { supabase } from '@/lib/supabase';

function asPoint(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

async function readDevicePoint() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.geolocation) {
    const error = new Error('Máy này không có định vị.');
    error.code = 'LOCATION_OFF';
    throw error;
  }

  const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesOn) {
    const error = new Error('Định vị đang tắt.');
    error.code = 'LOCATION_OFF';
    throw error;
  }

  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await Location.requestForegroundPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error('Lấy vị trí quá lâu.');
        error.code = 'LOCATION_TIMEOUT';
        reject(error);
      }, 12000);
    }),
  ]);

  const point = asPoint(position?.coords?.latitude, position?.coords?.longitude);
  if (!point) {
    const error = new Error('Không đọc được tọa độ.');
    error.code = 'LOCATION_OFF';
    throw error;
  }
  return point;
}

async function readableAddress(point) {
  const area = await areaFromCoordinates(point);
  return area?.label || '';
}

export async function saveDetailedPlace(userId, place) {
  if (!userId || String(userId).startsWith('local-')) return false;
  const row = {
    latitude: place.latitude,
    longitude: place.longitude,
    location_updated_at: new Date().toISOString(),
  };
  if (place.address) row.address = place.address;

  let saved = await supabase.from('profiles').update(row).eq('id', userId);
  if (!saved.error) return true;

  if (/location_updated_at/i.test(saved.error.message || '')) {
    delete row.location_updated_at;
    saved = await supabase.from('profiles').update(row).eq('id', userId);
    if (!saved.error) return true;
  }
  if (/address/i.test(saved.error?.message || '') && /schema cache|42703|column/i.test(saved.error.message || '')) {
    delete row.address;
    saved = await supabase.from('profiles').update(row).eq('id', userId);
  }
  return !saved.error;
}

export async function fetchCurrentPlace() {
  const point = await readDevicePoint();
  if (!point) return null;
  let address = '';
  try {
    address = await readableAddress(point);
  } catch {
    address = '';
  }
  return { ...point, address };
}

export async function checkAndFetchStartupLocation(userId) {
  try {
    const place = await fetchCurrentPlace();
    if (!place) return null;
    if (userId) {
      const saved = await saveDetailedPlace(userId, place);
      if (!saved) {
        console.log('Auto fetch location on startup error:', new Error('Không lưu được địa chỉ chi tiết.'));
      }
    }
    return place;
  } catch (err) {
    console.log('Auto fetch location on startup error:', err);
    return null;
  }
}
