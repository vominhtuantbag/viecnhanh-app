import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import {
  applyReferralCode,
  fetchMyReferrals,
  redeemVoucherCode,
  referralShareText,
} from '@/services/referrals';

export default function ReferralScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [voucher, setVoucher] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const list = await fetchMyReferrals(profile?.id);
    setRows(list);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  async function shareCode() {
    const code = profile?.referral_code;
    if (!code) {
      Alert.alert('Chưa có mã', 'Chạy SQL giới thiệu trên Supabase rồi mở lại màn hình này.');
      return;
    }
    try {
      await Share.share({ message: referralShareText(code) });
    } catch {
      // User cancelled share sheet.
    }
  }

  async function onApply() {
    setBusy('ref');
    try {
      const amount = await applyReferralCode(inviteCode);
      await refreshProfile();
      await load();
      setInviteCode('');
      Alert.alert('Áp dụng thành công', `Cả hai bên vừa nhận ${formatPrice(amount)}.`);
    } catch (err) {
      Alert.alert('Không áp dụng được', err.message ?? 'Kiểm tra mã rồi thử lại.');
    } finally {
      setBusy('');
    }
  }

  async function onRedeem() {
    setBusy('voucher');
    try {
      const amount = await redeemVoucherCode(voucher);
      await refreshProfile();
      setVoucher('');
      Alert.alert('Đã cộng ví', `Mã hợp lệ. +${formatPrice(amount)}.`);
    } catch (err) {
      Alert.alert('Không dùng mã được', err.message ?? 'Thử WELCOME10 nếu bạn chưa dùng.');
    } finally {
      setBusy('');
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.note}>Đăng nhập để lấy mã mời bạn bè.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.codeCard}>
          <Text style={styles.kicker}>Mã của bạn</Text>
          <Text style={styles.code}>{profile?.referral_code || '---'}</Text>
          <Text style={styles.hint}>Bạn bè nhập mã này lúc đăng ký, cả hai nhận 5.000 đ.</Text>
          <Pressable style={styles.primary} onPress={shareCode}>
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Gửi mã cho bạn bè</Text>
          </Pressable>
        </View>

        {profile?.referred_by ? null : (
          <View style={styles.card}>
            <Text style={styles.label}>Bạn được người khác mời?</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập mã giới thiệu"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="characters"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
            <Pressable style={styles.secondary} onPress={onApply} disabled={busy === 'ref'}>
              <Text style={styles.secondaryText}>{busy === 'ref' ? 'Đang áp dụng...' : 'Áp dụng mã mời'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Mã giảm giá / cộng ví</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ WELCOME10"
            placeholderTextColor={Colors.textLight}
            autoCapitalize="characters"
            value={voucher}
            onChangeText={setVoucher}
          />
          <Pressable style={styles.secondary} onPress={onRedeem} disabled={busy === 'voucher'}>
            <Text style={styles.secondaryText}>{busy === 'voucher' ? 'Đang dùng...' : 'Đổi mã'}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Người đã dùng mã của bạn</Text>
        {rows.length ? (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{row.inviteeName}</Text>
                <Text style={styles.rowMeta}>{row.code}</Text>
              </View>
              <Text style={styles.rowReward}>+{formatPrice(row.rewardAmount)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Chưa có ai nhập mã của bạn.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  note: { padding: 20, color: Colors.textMuted },
  codeCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 20,
    gap: 8,
    ...Shadow.card,
  },
  kicker: { color: '#D6E4FF', fontWeight: '700' },
  code: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  hint: { color: '#D6E4FF', lineHeight: 20 },
  primary: {
    marginTop: 8,
    backgroundColor: '#003EC4',
    minHeight: 46,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
    ...Shadow.soft,
  },
  label: { fontWeight: '800', color: Colors.text },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: 46,
    paddingHorizontal: 12,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  secondary: {
    minHeight: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: Colors.primary, fontWeight: '800' },
  section: { marginTop: 8, fontWeight: '800', color: Colors.text, fontSize: 16 },
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontWeight: '700', color: Colors.text },
  rowMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rowReward: { color: Colors.success, fontWeight: '800' },
  empty: { color: Colors.textMuted },
});
