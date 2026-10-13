import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import {
  PAYMENT_KINDS,
  adjustWallet,
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  paymentKindLabel,
  setDefaultPaymentMethod,
} from '@/services/account';

export default function PaymentsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('bank');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const profileId = profile?.id;
  const load = useCallback(async () => {
    if (!profileId) {
      setMethods([]);
      setLoading(false);
      return;
    }
    const rows = await fetchPaymentMethods(profileId);
    setMethods(rows);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => setLoading(false));
    }, [load])
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator style={{ marginTop: 32 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  async function addMethod() {
    if (!accountName.trim() || (kind !== 'cash' && !accountNumber.trim())) {
      Alert.alert('Thiếu thông tin', 'Nhập tên chủ tài khoản và số tài khoản / số ví.');
      return;
    }
    setSaving(true);
    try {
      await createPaymentMethod(profile.id, {
        kind,
        accountName,
        accountNumber,
        isDefault: methods.length === 0,
      });
      setAccountName('');
      setAccountNumber('');
      await load();
    } catch (err) {
      Alert.alert('Không lưu được', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function changeWallet(sign) {
    const value = Number(String(amount).replace(/\D/g, ''));
    if (!value) {
      Alert.alert('Số tiền không hợp lệ', 'Nhập số tiền muốn nạp hoặc rút.');
      return;
    }
    if (sign < 0 && value > (profile.wallet_balance || 0)) {
      Alert.alert('Không đủ số dư', 'Số dư ví không đủ để rút.');
      return;
    }
    setSaving(true);
    try {
      await adjustWallet(profile.id, profile.wallet_balance, sign * value);
      await refreshProfile();
      setAmount('');
    } catch (err) {
      Alert.alert('Không thực hiện được', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wallet}>
          <Text style={styles.walletLabel}>Số dư ví test</Text>
          <Text style={styles.walletValue}>{formatPrice(profile?.wallet_balance ?? 0)}</Text>
          <TextInput
            style={styles.input}
            placeholder="Số tiền nạp / rút (VNĐ)"
            placeholderTextColor={Colors.textLight}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <View style={styles.rowBtns}>
            <Pressable style={styles.primary} onPress={() => changeWallet(1)} disabled={saving}>
              <Text style={styles.primaryText}>Nạp tiền</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => changeWallet(-1)} disabled={saving}>
              <Text style={styles.secondaryText}>Rút tiền</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.section}>Liên kết ví / tài khoản</Text>
        {loading ? <ActivityIndicator color={Colors.primary} /> : null}
        {methods.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>{item.label || paymentKindLabel(item.kind)}</Text>
              {item.isDefault ? <Text style={styles.default}>Mặc định</Text> : null}
            </View>
            <Text style={styles.meta}>{item.accountName}</Text>
            {item.accountNumber ? <Text style={styles.meta}>{item.accountNumber}</Text> : null}
            <View style={styles.cardActions}>
              {!item.isDefault ? (
                <Pressable onPress={() => setDefaultPaymentMethod(profile.id, item.id).then(load)}>
                  <Text style={styles.link}>Đặt mặc định</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() =>
                  Alert.alert('Xóa phương thức', 'Gỡ liên kết này?', [
                    { text: 'Hủy', style: 'cancel' },
                    {
                      text: 'Xóa',
                      style: 'destructive',
                      onPress: () => deletePaymentMethod(item.id).then(load),
                    },
                  ])
                }>
                <Text style={styles.danger}>Xóa</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Text style={styles.section}>Thêm phương thức</Text>
        <View style={styles.kinds}>
          {PAYMENT_KINDS.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.kind, kind === item.id && styles.kindActive]}
              onPress={() => setKind(item.id)}>
              <Text style={[styles.kindText, kind === item.id && styles.kindTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Tên chủ tài khoản / ví"
          placeholderTextColor={Colors.textLight}
          value={accountName}
          onChangeText={setAccountName}
        />
        {kind !== 'cash' ? (
          <TextInput
            style={styles.input}
            placeholder={kind === 'bank' ? 'Số tài khoản' : 'Số điện thoại ví'}
            placeholderTextColor={Colors.textLight}
            value={accountNumber}
            onChangeText={setAccountNumber}
          />
        ) : null}
        <Pressable style={styles.primary} onPress={addMethod} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? 'Đang lưu...' : 'Lưu phương thức'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  wallet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  walletLabel: { color: Colors.textMuted, fontWeight: '700' },
  walletValue: { marginTop: 4, fontSize: 28, fontWeight: '800', color: Colors.primary },
  section: { marginTop: 14, fontSize: 16, fontWeight: '800', color: Colors.text },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadow.soft,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontWeight: '800', color: Colors.text },
  default: { color: Colors.success, fontWeight: '800', fontSize: 12 },
  meta: { marginTop: 4, color: Colors.textMuted },
  cardActions: { marginTop: 10, flexDirection: 'row', gap: 16 },
  link: { color: Colors.primary, fontWeight: '700' },
  danger: { color: '#D92D20', fontWeight: '700' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  kindActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  kindText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },
  kindTextActive: { color: Colors.primary },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text,
  },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: Colors.primary, fontWeight: '800' },
});
