import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const LocationContext = createContext(null);

function asPoint(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

async function saveProfileCoordinates(userId, point) {
  if (!userId || String(userId).startsWith('local-')) return false;
  const stamp = new Date().toISOString();
  const full = await supabase
    .from('profiles')
    .update({
      latitude: point.latitude,
      longitude: point.longitude,
      location_updated_at: stamp,
    })
    .eq('id', userId);
  if (!full.error) return true;
  if (/location_updated_at/i.test(full.error.message || '')) {
    const plain = await supabase
      .from('profiles')
      .update({ latitude: point.latitude, longitude: point.longitude })
      .eq('id', userId);
    return !plain.error;
  }
  return false;
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
  if (status !== 'granted') {
    const error = new Error('Bạn chưa cho phép dùng vị trí.');
    error.code = 'LOCATION_DENIED';
    throw error;
  }

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

export function LocationProvider({ children }) {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id || null;
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle');
  const flight = useRef(null);
  const askedFor = useRef('');

  const savedLat = profile?.latitude;
  const savedLng = profile?.longitude;
  const saved = useMemo(() => asPoint(savedLat, savedLng), [savedLat, savedLng]);
  const point = coords || saved;

  const ensureLocation = useCallback(async () => {
    if (flight.current) return flight.current;
    const run = (async () => {
      setStatus('asking');
      try {
        const next = await readDevicePoint();
        setCoords(next);
        setStatus('ready');
        if (userId) {
          const savedOk = await saveProfileCoordinates(userId, next);
          if (savedOk) refreshProfile().catch(() => {});
        }
        return next;
      } catch (error) {
        const code = error?.code;
        if (code === 'LOCATION_DENIED') setStatus('denied');
        else if (code === 'LOCATION_TIMEOUT') setStatus('timeout');
        else setStatus('off');
        return null;
      }
    })();
    flight.current = run;
    try {
      return await run;
    } finally {
      flight.current = null;
    }
  }, [refreshProfile, userId]);

  useEffect(() => {
    if (!userId || askedFor.current === userId) return undefined;
    const timer = setTimeout(() => {
      askedFor.current = userId;
      ensureLocation().catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [ensureLocation, userId]);

  const value = useMemo(
    () => ({
      point,
      status,
      ensureLocation,
    }),
    [ensureLocation, point, status]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation phải được dùng bên trong LocationProvider');
  }
  return context;
}
