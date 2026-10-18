import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  checkAndFetchStartupLocation,
  fetchCurrentPlace,
  saveDetailedPlace,
} from '@/services/location';

const LocationContext = createContext(null);

function asPoint(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function LocationProvider({ children }) {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id || null;
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle');
  const flight = useRef(null);
  const startupFor = useRef('');

  const savedLat = profile?.latitude;
  const savedLng = profile?.longitude;
  const saved = useMemo(() => asPoint(savedLat, savedLng), [savedLat, savedLng]);
  const point = coords || saved;

  const ensureLocation = useCallback(async () => {
    if (flight.current) return flight.current;
    const run = (async () => {
      setStatus('asking');
      try {
        const next = await fetchCurrentPlace();
        if (!next) {
          setStatus('denied');
          return null;
        }
        setCoords(next);
        setStatus('ready');
        if (userId) {
          const savedOk = await saveDetailedPlace(userId, next);
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
    const key = userId || 'guest';
    if (startupFor.current === key) return undefined;
    startupFor.current = key;
    let fired = false;
    const timer = setTimeout(() => {
      fired = true;
      checkAndFetchStartupLocation(userId)
        .then((place) => {
          if (!place) return;
          setCoords(place);
          setStatus('ready');
          if (userId) refreshProfile().catch(() => {});
        })
        .catch((err) => {
          console.log('Auto fetch location on startup error:', err);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      if (!fired) startupFor.current = '';
    };
  }, [refreshProfile, userId]);

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
