import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { NOTIFY_DEFAULTS } from '@/constants/notifications';
import { useAuth } from '@/context/AuthContext';
import { registerForPushNotifications } from '@/lib/push';
import { mapNotifyPrefs, saveNotifyPrefs, upsertPushToken } from '@/services/notifications';

const LISTING_ROWS = [
  {
    key: 'notify_new_bids',
    title: 'Có đề xuất mới',
    hint: 'Khi thợ gửi báo giá cho tin bạn đăng.',
  },
  {
    key: 'notify_messages',
    title: 'Có tin nhắn mới',
    hint: 'Khi có tin nhắn trong cuộc trò chuyện của tin đăng.',
  },
  {
    key: 'notify_hired',
    title: 'Được thuê',
    hint: 'Khi người đăng tin xác nhận thuê bạn.',
  },
  {
    key: 'notify_hire_cancelled',
    title: 'Hủy thuê',
    hint: 'Khi người đăng hủy thuê công việc đang làm.',
  },
  {
    key: 'notify_reviews',
    title: 'Đánh giá',
    hint: 'Khi bạn nhận đánh giá sau khi hoàn thành việc.',
  },
];

export default function NotificationSettingsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [override, setOverride] = useState(null);
  const [saving, setSaving] = useState(false);
  const prefs = { ...mapNotifyPrefs(profile), ...override };

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.note}>Đang chuyển đến đăng nhập...</Text>
      </SafeAreaView>
    );
  }

  async function toggle(key, value) {
    const next = { ...prefs, [key]: value };
    if (key !== 'notify_push' && !next.notify_push) {
      return;
    }
    setOverride((current) => ({ ...current, [key]: value }));
    setSaving(true);
    try {
      await saveNotifyPrefs(profile.id, { [key]: value });
      if (key === 'notify_push' && value) {
        const token = await registerForPushNotifications();
        if (token) await upsertPushToken(profile.id, token);
      }
      await refreshProfile();
      setOverride(null);
    } catch (err) {
      setOverride(null);
      Alert.alert('Không lưu được', err.message ?? 'Vui lòng chạy migration thông báo đẩy rồi thử lại.');
    } finally {
      setSaving(false);
    }
  }

  const masterOn = prefs.notify_push !== false;
  const locked = saving || !masterOn;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Row
            title="Bật thông báo đẩy"
            hint="Công tắc tổng. Tắt thì hệ thống không gửi bất kỳ push nào đến thiết bị của bạn."
            value={masterOn}
            disabled={saving}
            onValueChange={(value) => toggle('notify_push', value)}
          />
        </View>

        <Text style={styles.sectionTitle}>Ví</Text>
        <View style={styles.card}>
          <Row
            title="Biến động số dư trong ví"
            hint="Khi ví cộng hoặc trừ tiền (phí đề xuất, nạp test, hoàn tất việc)."
            value={prefs.notify_wallet}
            disabled={locked}
            onValueChange={(value) => toggle('notify_wallet', value)}
          />
        </View>

        <Text style={styles.sectionTitle}>Cập nhật tin đăng</Text>
        <View style={styles.card}>
          {LISTING_ROWS.map((item, index) => (
            <Row
              key={item.key}
              title={item.title}
              hint={item.hint}
              value={prefs[item.key] ?? NOTIFY_DEFAULTS[item.key]}
              disabled={locked}
              onValueChange={(value) => toggle(item.key, value)}
              last={index === LISTING_ROWS.length - 1}
            />
          ))}
        </View>
        <Text style={styles.groupNote}>
          Các thông báo liên quan tin đăng được gom nhóm trên thiết bị (cùng kênh / cùng cụm). Ví, việc mới và khuyến mãi tách riêng.
        </Text>

        <Text style={styles.sectionTitle}>Khuyến mãi</Text>
        <View style={styles.card}>
          <Row
            title="Khuyến mãi, mẹo vặt"
            hint="Ưu đãi, mẹo dùng app. Không liên quan tin đăng hay ví."
            value={prefs.notify_promo}
            disabled={locked}
            onValueChange={(value) => toggle('notify_promo', value)}
          />
        </View>

        <Pressable style={styles.linkCard} onPress={() => router.push('/settings/job-alerts')}>
          <View style={styles.iconWrap}>
            <Ionicons name="briefcase-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>Thông báo việc làm</Text>
            <Text style={styles.hint}>Chọn danh mục và khu vực để nhận việc mới phù hợp.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
        </Pressable>

        <Text style={styles.note}>
          Tùy chọn được lưu trên tài khoản và dùng để lọc push phía máy chủ. Push thật trên iOS/Android cần bản build có cấu hình FCM/APNs.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ title, hint, value, onValueChange, disabled, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowBody}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={Boolean(value)}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.primarySoft }}
        thumbColor={value ? Colors.primary : Colors.textLight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 8,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  title: { fontWeight: '800', color: Colors.text, fontSize: 15 },
  hint: { marginTop: 4, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  groupNote: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  linkCard: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadow.card,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { marginTop: 16, color: Colors.textMuted, lineHeight: 20, fontSize: 13 },
});
