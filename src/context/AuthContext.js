import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router, useGlobalSearchParams, useRootNavigationState, useSegments } from 'expo-router';

import {
  createSessionFromUrl,
  signInWithApple as appleAuth,
  signInWithGoogle as googleAuth,
  signInWithPhone as phoneSignIn,
  signOut as authSignOut,
  signUpWithPhone as phoneSignUp,
} from '@/services/auth';
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
      setSession(data.session ?? null);
      await hydrateUser(data.session);
      if (!cancelled) {
        setLoading(false);
        setBootstrapped(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await hydrateUser(nextSession);
      setLoading(false);
      setBootstrapped(true);
    });

    const incoming = Linking.getLinkingURL();
    if (incoming) {
      createSessionFromUrl(incoming).catch(() => {});
    }

    const sub = Linking.addEventListener('url', ({ url }) => {
      createSessionFromUrl(url).catch(() => {});
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
    const data = await phoneSignIn(payload);
    setSession(data.session);
    await hydrateUser(data.session);
    return data.session;
  }, [hydrateUser]);

  const signUpWithPhone = useCallback(async (payload) => {
    const data = await phoneSignUp(payload);
    setSession(data.session);
    await hydrateUser(data.session);
    if (payload?.referralCode) {
      try {
        await applyReferralCode(payload.referralCode);
        await hydrateUser(data.session);
      } catch {
        // Hồ sơ vẫn tạo được nếu mã mời sai; người dùng nhập lại trong Mời bạn bè.
      }
    }
    return data.session;
  }, [hydrateUser]);

  const signInWithGoogle = useCallback(async () => {
    const nextSession = await googleAuth();
    if (nextSession) {
      setSession(nextSession);
      await hydrateUser(nextSession);
    }
    return nextSession;
  }, [hydrateUser]);

  const signInWithApple = useCallback(async () => {
    const nextSession = await appleAuth();
    if (nextSession) {
      setSession(nextSession);
      await hydrateUser(nextSession);
    }
    return nextSession;
  }, [hydrateUser]);

  const completeProfile = useCallback(
    async ({ fullName, phone, provinceId, wardId }) => {
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
      });
      setProfile(nextProfile);
      return nextProfile;
    },
    [session]
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setProfile(null);
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
