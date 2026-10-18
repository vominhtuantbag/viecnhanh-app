import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { toAuthErrorMessage } from '@/lib/auth-errors';
import { parseVnPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export const AUTH_REDIRECT = AuthSession.makeRedirectUri({
  scheme: 'appmuabanviec',
  path: 'auth/callback',
});

export async function createSessionFromUrl(url) {
  if (!url) return null;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(toAuthErrorMessage({ message: String(errorCode) }));
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw new Error(toAuthErrorMessage(error));
  return data.session;
}

export async function signUpWithPhone({ phone, password, referralCode }) {
  const parsed = parseVnPhone(phone);
  if (!parsed) {
    throw new Error('Số điện thoại không hợp lệ. Dùng số Việt Nam, ví dụ 0912 345 678.');
  }
  if (!password || password.length < 6) {
    throw new Error('Mật khẩu cần ít nhất 6 ký tự.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password,
    options: {
      data: {
        phone: parsed.e164,
        auth_provider: 'phone',
        referral_code: referralCode ? String(referralCode).trim() : '',
      },
    },
  });
  if (error) throw new Error(toAuthErrorMessage(error));

  if (!data.session) {
    const signedIn = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password,
    });
    if (signedIn.error) throw new Error(toAuthErrorMessage(signedIn.error));
    return signedIn.data;
  }

  return data;
}

export async function signInWithPhone({ phone, password }) {
  const parsed = parseVnPhone(phone);
  if (!parsed) {
    throw new Error('Số điện thoại không hợp lệ. Dùng số Việt Nam, ví dụ 0912 345 678.');
  }
  if (!password) {
    throw new Error('Vui lòng nhập mật khẩu.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password,
  });
  if (error) throw new Error(toAuthErrorMessage(error));
  return data;
}

export async function signInWithOAuthProvider(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: AUTH_REDIRECT,
      skipBrowserRedirect: true,
      ...(provider === 'google'
        ? {
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            },
          }
        : {}),
    },
  });
  if (error) throw new Error(toAuthErrorMessage(error));
  if (!data?.url) {
    throw new Error('Không mở được trang đăng nhập. Kiểm tra Google/Apple đã bật trên Supabase.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Bạn đã hủy đăng nhập.');
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('Đăng nhập chưa hoàn tất. Vui lòng thử lại.');
  }

  return createSessionFromUrl(result.url);
}

export async function signInWithGoogle() {
  return signInWithOAuthProvider('google');
}

export async function signInWithApple() {
  if (Platform.OS === 'ios') {
    const available = await AppleAuthentication.isAvailableAsync();
    if (available) {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error('Apple không trả về mã xác thực. Thử lại trên thiết bị thật.');
        }

        const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(' ');

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;

        if (fullName) {
          await supabase.auth.updateUser({
            data: { full_name: fullName, name: fullName },
          });
        }

        return data.session;
      } catch (error) {
        if (error?.code === 'ERR_REQUEST_CANCELED') {
          throw new Error('Bạn đã hủy đăng nhập.');
        }
        throw new Error(toAuthErrorMessage(error));
      }
    }
  }

  return signInWithOAuthProvider('apple');
}

function clearStoredSession() {
  try {
    const store = globalThis.localStorage;
    if (!store) return;
    const keys = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && key.startsWith('sb-') && key.includes('auth')) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch (error) {
    console.log('Logout error:', error);
  }
}

export async function signOut() {
  let failed = null;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.log('Logout error:', error);
    failed = error;
    try {
      await supabase.auth.signOut({ scope: 'local' });
      failed = null;
    } catch (localError) {
      console.log('Logout error:', localError);
      failed = localError;
    }
  }
  clearStoredSession();
  if (failed) {
    throw new Error(failed.message || 'Đăng xuất thất bại, vui lòng thử lại.');
  }
}
