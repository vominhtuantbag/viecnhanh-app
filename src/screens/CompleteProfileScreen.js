import { useMemo, useState } from 'react';
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

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { toAuthErrorMessage } from '@/lib/auth-errors';
import { isPhoneAliasEmail } from '@/lib/phone';

export default function CompleteProfileScreen() {
  const params = useLocalSearchParams();
  const { user, profile, completeProfile, signOut, isComplete } = useAuth();
  const isEdit = String(params.mode || '') === 'edit';
  const socialLogin = user ? !isPhoneAliasEmail(user.email) : false;

  const [fullName, setFullName] = useState(
    () => profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  );
  const [phone, setPhone] = useState(
    () => profile?.phone || user?.user_metadata?.phone || ''
  );
  const [referralCode, setReferralCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(
    () => (isComplete || isEdit ? 'Cập nhật hồ sơ' : 'Hoàn tất hồ sơ để bắt đầu'),
    [isComplete, isEdit]
  );

  async function onSave() {
    setError('');
    setBusy(true);
    try {
      await completeProfile({ fullName, phone, referralCode });
      if (isEdit && router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/browse');
      }
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      setError(toAuthErrorMessage(err));
      setBusy(false);
    }
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
          <View style={styles.heroIcon}>
            <Ionicons name="person-circle-outline" size={42} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            {socialLogin
              ? 'Bạn đăng nhập bằng Google/Apple. Hãy thêm họ tên và số điện thoại để khách hàng liên hệ khi nhận việc.'
              : 'Chỉ còn họ và tên — số điện thoại đã gắn với tài khoản của bạn.'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Họ & Tên</Text>
            <TextInput
              style={styles.input}
              placeholder="Nguyễn Văn A"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={[styles.input, !socialLogin && profile?.phone ? styles.inputLocked : null]}
              placeholder="0912 345 678"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={socialLogin || !profile?.phone}
            />
            {!socialLogin && profile?.phone ? (
              <Text style={styles.hint}>Số điện thoại dùng để đăng nhập, không đổi tại đây.</Text>
            ) : (
              <Text style={styles.hint}>Dùng số Việt Nam. Người thuê việc sẽ thấy số này.</Text>
            )}

            {!profile?.referred_by ? (
              <>
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
              style={[styles.primary, busy && styles.disabled]}
              onPress={onSave}
              disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Lưu và tiếp tục</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.logout} onPress={onLogout} disabled={busy}>
            <Text style={styles.logoutText}>Đăng xuất để dùng tài khoản khác</Text>
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
    paddingTop: 24,
    paddingBottom: 32,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    marginTop: 22,
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
  inputLocked: {
    color: Colors.textMuted,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  error: {
    marginTop: 12,
    color: '#D92D20',
    fontWeight: '600',
    fontSize: 13,
  },
  primary: {
    marginTop: 18,
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
  logout: {
    marginTop: 20,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
