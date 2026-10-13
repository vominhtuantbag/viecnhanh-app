import '@/lib/sqlite-storage';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

import { authStorage } from '@/lib/auth-storage';

const extra = Constants.expoConfig?.extra || {};
const fallbackUrl = 'https://trjyeetrtzkwhwgsvkta.supabase.co';
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyanllZXRydHprd2h3Z3N2a3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTE4MjQsImV4cCI6MjEwNjkyNzgyNH0.fFGMd83noeo_tPgajjyPeTay9Atud4TC0MAdzp0QwBU';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || fallbackUrl;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  extra.supabaseAnonKey ||
  fallbackAnonKey;

if (!process.env.EXPO_PUBLIC_SUPABASE_URL && !extra.supabaseUrl) {
  console.warn(
    '[Việc Nhanh] Chưa thấy EXPO_PUBLIC_SUPABASE_URL lúc build web. Đang dùng địa chỉ dự phòng.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export async function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message || 'Không kết nối được Supabase.');
  }
  return data;
}
