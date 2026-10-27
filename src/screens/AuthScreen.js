import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import SocialLoginRow from '@/components/SocialLoginRow';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { toAuthErrorMessage } from '@/lib/auth-errors';

export default function AuthScreen({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const params = useLocalSearchParams();
  const { signInWithPhone, signUpWithPhone, signInWithGoogle, signInWithApple, signInWithFacebook } =
    useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referralCode, setReferralCode] = useState(String(params.ref || ''));
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loading = Boolean(busy);

  async function run(action, key) {
    setError('');
    setBusy(key);
    try {
      await action();
      // AuthRedirect đọc profiles (họ tên + SĐT) rồi mới quyết định
      // complete-profile (lần đầu) hay Khám phá (đã có hồ sơ).
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  function onSubmit() {
    if (isRegister && password !== confirm) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    run(
      () =>
        isRegister
          ? signUpWithPhone({ phone, password, referralCode })
          : signInWithPhone({ phone, password }),
      'phone'
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable
            style={styles.back}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/account');
            }}
            hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
            <Text style={styles.backText}>Quay lại</Text>
          </Pressable>

          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="flash" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>Việc Nhanh</Text>
            <Text style={styles.headline}>
              {isRegister ? 'Tạo tài khoản để đăng việc & nhận việc' : 'Chào mừng trở lại'}
            </Text>
            <Text style={styles.sub}>
              {isRegister
                ? 'Đăng ký bằng số điện thoại. Ví test 50.000 đ sẽ được cộng sẵn.'
                : 'Đăng nhập bằng số điện thoại hoặc tài khoản mạng xã hội.'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Số điện thoại</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>+84</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="912 345 678"
                placeholderTextColor={Colors.textLight}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder={isRegister ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'}
                placeholderTextColor={Colors.textLight}
                secureTextEntry={!showPassword}
                autoComplete={isRegister ? 'new-password' : 'password'}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </Pressable>
            </View>

            {isRegister ? (
              <>
                <Text style={styles.label}>Nhập lại mật khẩu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor={Colors.textLight}
                  secureTextEntry={!showPassword}
                  value={confirm}
                  onChangeText={setConfirm}
                />
                <Text style={styles.label}>Mã giới thiệu (không bắt buộc)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ VNAB12CD"
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="characters"
                  value={referralCode}
                  onChangeText={setReferralCode}
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primary, loading && styles.disabled]}
              onPress={onSubmit}
              disabled={loading}>
              {busy === 'phone' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>
                  {isRegister ? 'Đăng ký' : 'Đăng nhập'}
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>hoặc tiếp tục với</Text>
            <View style={styles.line} />
          </View>

          <SocialLoginRow
            busy={busy}
            disabled={loading}
            onGoogle={() => run(signInWithGoogle, 'google')}
            onApple={() => run(signInWithApple, 'apple')}
            onFacebook={() => run(signInWithFacebook, 'facebook')}
          />

          <Pressable
            style={styles.switch}
            onPress={() =>
              router.replace({
                pathname: isRegister ? '/(auth)/login' : '/(auth)/register',
                params,
              })
            }>
            <Text style={styles.switchMuted}>
              {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
              <Text style={styles.switchStrong}>{isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontWeight: '700',
    color: Colors.text,
  },
  brand: {
    marginTop: 18,
    marginBottom: 18,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.4,
  },
  headline: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 32,
  },
  sub: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  prefix: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: Colors.primarySoft,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  prefixText: {
    fontWeight: '800',
    color: Colors.primary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  error: {
    marginTop: 12,
    color: '#D92D20',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.7,
  },
  dividerRow: {
    marginVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
  },
  switch: {
    marginTop: 10,
    alignItems: 'center',
  },
  switchMuted: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  switchStrong: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
