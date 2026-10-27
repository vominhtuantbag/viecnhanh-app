import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router, useGlobalSearchParams, useRootNavigationState, useSegments } from 'expo-router';

import {
  createSessionFromUrl,
  signInWithApple as appleAuth,
  signInWithFacebook as facebookAuth,
  signInWithGoogle as googleAuth,
  signInWithPhone as phoneSignIn,
  signOut as authSignOut,
  signUpWithPhone as phoneSignUp,
} from '@/services/auth';
import {
  enforceSingleDevice,
  forgetActiveUser,
  getDeviceId,
  OTHER_DEVICE_MESSAGE,
  takeReplacedLoginNotice,
} from '@/services/device-session';
import { subscribePostgresChanges } from '@/lib/realtime';
import { ensureAuthProfile, isProfileComplete, updateProfile } from '@/services/profiles';
import { parseVnPhone } from '@/lib/phone';
import { applyReferralCode } from '@/services/referrals';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export const DEFAULT_HOME = '/(tabs)/browse';

function homeFromParams(params) {
  const redirect = String(params.redirect || '');
  if (redirect.startsWith('/') && !redirect.startsWith('/(auth)')) return redirect;
  return DEFAULT_HOME;
}

function isOAuthReturn() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  const query = `${window.location.hash}${window.location.search}`;
  const onCallback = path.includes('auth/callback') || path.includes('login');
  return onCallback && (query.includes('access_token=') || query.includes('code='));
}

function notifyReplaced(message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }
  Alert.alert('Đăng nhập thiết bị khác', message);
}

let shownReplacedNotice = '';

function ReplacedSessionGate({ message, onDone }) {
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!message) {
      shownReplacedNotice = '';
      return;
    }
    if (!navigationState?.key || shownReplacedNotice === message) return;
    shownReplacedNotice = message;
    notifyReplaced(message);
    router.replace('/(auth)/login');
    onDone();
  }, [message, navigationState?.key, onDone]);

  return null;
}

function AuthRedirect({ session, profile, loading, profileReady }) {
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (loading || !profileReady || !navigationState?.key) return;

    const group = segments[0];
    const screen = segments[1];
    if (group === 'landing' || group === 'admin') return;
    const inAuth = group === '(auth)';
    const onComplete = inAuth && screen === 'complete-profile';
    const editingProfile = onComplete && String(params.mode || '') === 'edit';
    const complete = isProfileComplete(profile);
    const nextHome = homeFromParams(params);

    if (session && !complete && !onComplete) {
      router.replace('/(auth)/complete-profile');
      return;
    }

    if (session && complete && inAuth && !editingProfile) {
      router.replace(nextHome);
    }
  }, [
    loading,
    navigationState?.key,
    params.mode,
    params.redirect,
    profile,
    profileReady,
    segments,
    session,
  ]);

  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [replacedNotice, setReplacedNotice] = useState('');
  const takeoverRef = useRef(false);
  const replacedRef = useRef(false);
  const voluntaryRef = useRef(false);
  const localDeviceIdRef = useRef('');
  const sessionUserRef = useRef(null);
  sessionUserRef.current = session?.user ?? null;

  const hydrateUser = useCallback(async (nextSession) => {
    if (!nextSession?.user) {
      setProfile(null);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    try {
      const nextProfile = await ensureAuthProfile(nextSession.user);
      setProfile(nextProfile);
    } catch {
      setProfile(null);
    } finally {
      setProfileReady(true);
    }
  }, []);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    let cancelled = false;

    if (Platform.OS === 'android') {
      WebBrowser.warmUpAsync();
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const nextSession = data.session ?? null;
      if (!nextSession) {
        const replaced = await takeReplacedLoginNotice();
        if (!cancelled && replaced) setReplacedNotice(OTHER_DEVICE_MESSAGE);
      } else if (isOAuthReturn()) {
        takeoverRef.current = true;
      }
      setSession(nextSession);
      await hydrateUser(nextSession);
      if (takeoverRef.current && nextSession?.user) {
        try {
          localDeviceIdRef.current = await getDeviceId();
          const result = await enforceSingleDevice(nextSession.user, { takeover: true });
          if (result.deviceId) localDeviceIdRef.current = result.deviceId;
        } catch (error) {
          console.log('Không gắn được thiết bị đăng nhập:', error?.message || error);
        } finally {
          takeoverRef.current = false;
        }
      }
      if (!cancelled) {
        setLoading(false);
        setBootstrapped(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'SIGNED_OUT' && !nextSession && !voluntaryRef.current && !replacedRef.current) {
        try {
          const replaced = await takeReplacedLoginNotice();
          if (replaced) {
            replacedRef.current = true;
            setReplacedNotice(OTHER_DEVICE_MESSAGE);
          }
        } catch (error) {
          console.log('Không kiểm tra được phiên đăng nhập:', error?.message || error);
        }
      }
      setSession(nextSession);
      await hydrateUser(nextSession);
      setLoading(false);
      setBootstrapped(true);
    });

    async function claimLinkedSession(url) {
      const looksLikeLogin = typeof url === 'string' && (url.includes('access_token=') || url.includes('refresh_token='));
      if (looksLikeLogin) takeoverRef.current = true;
      try {
        const nextSession = await createSessionFromUrl(url);
        if (!looksLikeLogin || !nextSession?.user) return;
        localDeviceIdRef.current = await getDeviceId();
        const result = await enforceSingleDevice(nextSession.user, { takeover: true });
        if (result.deviceId) localDeviceIdRef.current = result.deviceId;
      } catch {
        // Liên kết không phải phiên đăng nhập, hoặc người dùng đã hủy.
      } finally {
        if (looksLikeLogin) takeoverRef.current = false;
      }
    }

    const incoming = Linking.getLinkingURL();
    if (incoming) claimLinkedSession(incoming);

    const sub = Linking.addEventListener('url', ({ url }) => {
      claimLinkedSession(url);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      sub.remove();
      if (Platform.OS === 'android') {
        WebBrowser.coolDownAsync();
      }
    };
  }, [hydrateUser]);

  const clearReplacedNotice = useCallback(() => setReplacedNotice(''), []);

  const logoutBecauseReplaced = useCallback(async () => {
    if (replacedRef.current) return;
    replacedRef.current = true;
    try {
      await forgetActiveUser();
    } catch (error) {
      console.log('Logout error:', error);
    }
    setSession(null);
    setProfile(null);
    setProfileReady(true);
    setReplacedNotice(OTHER_DEVICE_MESSAGE);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.log('Logout error:', error);
    }
  }, []);

  const finishSignIn = useCallback(async (nextSession) => {
    if (!nextSession?.user) {
      takeoverRef.current = false;
      return nextSession ?? null;
    }
    replacedRef.current = false;
    takeoverRef.current = true;
    setSession(nextSession);
    try {
      localDeviceIdRef.current = await getDeviceId();
      await hydrateUser(nextSession);
      const result = await enforceSingleDevice(nextSession.user, { takeover: true });
      if (result.deviceId) localDeviceIdRef.current = result.deviceId;
      return nextSession;
    } finally {
      takeoverRef.current = false;
    }
  }, [hydrateUser]);

  const runSignIn = useCallback(async (action) => {
    replacedRef.current = false;
    takeoverRef.current = true;
    try {
      return await action();
    } catch (error) {
      takeoverRef.current = false;
      throw error;
    }
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return undefined;
    let cancelled = false;
    getDeviceId()
      .then((id) => {
        if (!cancelled && id) localDeviceIdRef.current = id;
      })
      .catch(() => {});

    const verify = async () => {
      if (cancelled || takeoverRef.current) return;
      const user = sessionUserRef.current;
      if (!user || user.id !== userId) return;
      try {
        const result = await enforceSingleDevice(user, { takeover: false });
        if (cancelled || takeoverRef.current) return;
        if (result.deviceId) localDeviceIdRef.current = result.deviceId;
        if (!result.ok) await logoutBecauseReplaced();
      } catch (error) {
        console.log('Không kiểm tra được thiết bị đăng nhập:', error?.message || error);
      }
    };

    verify();
    const timer = setInterval(verify, 12000);
    const unsubscribe = subscribePostgresChanges(`device-session:${userId}`, [
      {
        table: 'profiles',
        event: 'UPDATE',
        filter: `id=eq.${userId}`,
        callback: (payload) => {
          const nextId = payload?.new?.current_device_id;
          const localId = localDeviceIdRef.current;
          if (!nextId || !localId || takeoverRef.current || nextId === localId) return;
          logoutBecauseReplaced();
        },
      },
    ]);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') verify();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribe();
      appSub.remove();
    };
  }, [logoutBecauseReplaced, session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return null;
    }
    const nextProfile = await ensureAuthProfile(session.user);
    setProfile(nextProfile);
    return nextProfile;
  }, [session]);

  const signInWithPhone = useCallback(async (payload) => {
    return runSignIn(async () => {
      const data = await phoneSignIn(payload);
      return finishSignIn(data.session);
    });
  }, [finishSignIn, runSignIn]);

  const signUpWithPhone = useCallback(async (payload) => {
    return runSignIn(async () => {
      const data = await phoneSignUp(payload);
      const nextSession = await finishSignIn(data.session);
      if (payload?.referralCode && nextSession) {
        try {
          await applyReferralCode(payload.referralCode);
          await hydrateUser(nextSession);
        } catch {
          // Hồ sơ vẫn tạo được nếu mã mời sai; người dùng nhập lại trong Mời bạn bè.
        }
      }
      return nextSession;
    });
  }, [finishSignIn, hydrateUser, runSignIn]);

  const signInWithGoogle = useCallback(async () => {
    return runSignIn(async () => finishSignIn(await googleAuth()));
  }, [finishSignIn, runSignIn]);

  const signInWithApple = useCallback(async () => {
    return runSignIn(async () => finishSignIn(await appleAuth()));
  }, [finishSignIn, runSignIn]);

  const signInWithFacebook = useCallback(async () => {
    return runSignIn(async () => finishSignIn(await facebookAuth()));
  }, [finishSignIn, runSignIn]);

  const completeProfile = useCallback(
    async ({ fullName, phone, provinceId, wardId, address, latitude, longitude }) => {
      if (!session?.user) {
        throw new Error('Bạn cần đăng nhập trước khi cập nhật hồ sơ.');
      }
      const parsed = parseVnPhone(phone);
      if (!fullName?.trim()) {
        throw new Error('Vui lòng nhập họ và tên.');
      }
      if (!parsed) {
        throw new Error('Số điện thoại không hợp lệ. Dùng số Việt Nam, ví dụ 0912 345 678.');
      }
      if (!provinceId) {
        throw new Error('Vui lòng chọn tỉnh/thành.');
      }
      if (!wardId) {
        throw new Error('Vui lòng chọn xã/phường.');
      }

      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: parsed.e164,
        },
      });

      const nextProfile = await updateProfile(session.user.id, {
        full_name: fullName.trim(),
        phone: parsed.e164,
        email: session.user.email,
        province_id: provinceId,
        ward_id: wardId,
        address,
        latitude,
        longitude,
      });
      setProfile(nextProfile);
      return nextProfile;
    },
    [session]
  );

  const signOut = useCallback(async () => {
    voluntaryRef.current = true;
    try {
      await forgetActiveUser();
      await authSignOut();
    } catch (error) {
      console.log('Logout error:', error);
      throw error;
    } finally {
      setSession(null);
      setProfile(null);
      setProfileReady(true);
      voluntaryRef.current = false;
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: loading || Boolean(session && !profileReady),
      profileReady,
      isComplete: isProfileComplete(profile),
      signInWithPhone,
      signUpWithPhone,
      signInWithGoogle,
      signInWithApple,
      signInWithFacebook,
      completeProfile,
      refreshProfile,
      signOut,
    }),
    [
      completeProfile,
      loading,
      profile,
      profileReady,
      refreshProfile,
      session,
      signInWithApple,
      signInWithFacebook,
      signInWithGoogle,
      signInWithPhone,
      signOut,
      signUpWithPhone,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {bootstrapped ? (
        <AuthRedirect
          session={session}
          profile={profile}
          loading={loading}
          profileReady={profileReady}
        />
      ) : null}
      <ReplacedSessionGate message={replacedNotice} onDone={clearReplacedNotice} />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return context;
}
