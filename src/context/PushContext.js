import { createContext, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRootNavigationState } from 'expo-router';

import {
  addNotificationResponseListener,
  getInitialPushData,
  openFromPushData,
  resetSyncedPushToken,
  syncUserDeviceToken,
} from '@/lib/push';
import { removePushToken } from '@/services/notifications';
import { useAuth } from '@/context/AuthContext';

const PushContext = createContext(null);

export function PushProvider({ children }) {
  const { session, profile } = useAuth();
  const navigationState = useRootNavigationState();
  const tokenRef = useRef(null);
  const openedInitial = useRef(false);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || profile?.notify_push === false) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await syncUserDeviceToken(userId);
        if (!cancelled && token) tokenRef.current = token;
      } catch {
        // Expo Go / máy ảo: app vẫn chạy, chỉ chưa có push.
      }
    })();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncUserDeviceToken(userId).then((token) => {
          if (token) tokenRef.current = token;
        });
      }
    });

    return () => {
      cancelled = true;
      appSub.remove();
    };
  }, [profile?.notify_push, session?.user?.id]);

  useEffect(() => {
    if (session) return undefined;
    const token = tokenRef.current;
    tokenRef.current = null;
    resetSyncedPushToken();
    if (!token) return undefined;
    removePushToken(token).catch(() => {});
    return undefined;
  }, [session]);

  useEffect(() => {
    if (!navigationState?.key) return undefined;

    const sub = addNotificationResponseListener((data) => {
      openFromPushData(data);
    });

    if (!openedInitial.current) {
      openedInitial.current = true;
      getInitialPushData()
        .then((data) => {
          if (data) openFromPushData(data);
        })
        .catch(() => {});
    }

    return () => sub.remove();
  }, [navigationState?.key]);

  return <PushContext.Provider value={tokenRef}>{children}</PushContext.Provider>;
}

export function usePush() {
  return useContext(PushContext);
}
