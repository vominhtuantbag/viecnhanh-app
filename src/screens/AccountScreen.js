import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import { displayPhone, isPhoneAliasEmail } from '@/lib/phone';
import { initialsFromName } from '@/services/profiles';

const SECTIONS = [
  {
    title: 'Cài đặt tài khoản',
    items: [
      { icon: 'card-outline', label: 'Phương thức thanh toán', href: '/settings/payments' },
      { icon: 'notifications-outline', label: 'Tùy chọn thông báo', href: '/settings/notifications' },
    ],
  },
  {
    title: 'Kiếm tiền',
    items: [
      { icon: 'grid-outline', label: 'Bảng điều khiển của tôi', href: '/settings/dashboard' },
      { icon: 'trophy-outline', label: 'Nhiệm vụ & Nhận quà', href: '/settings/quests' },
      { icon: 'gift-outline', label: 'Mời bạn bè & Mã giảm giá', href: '/settings/referral' },
      {
        icon: 'briefcase-outline',
        label: 'Thông báo việc làm',
        hint: 'Nhận thông báo khi có công việc mới phù hợp với kỹ năng của bạn',
        href: '/settings/job-alerts',
      },
    ],
  },
  {
    title: 'Trợ giúp & Hỗ trợ',
    items: [
      { icon: 'globe-outline', label: 'Trang giới thiệu', href: '/landing' },
      { icon: 'help-circle-outline', label: 'Câu hỏi thường gặp' },
      { icon: 'people-outline', label: 'Quy tắc cộng đồng' },
      { icon: 'mail-outline', label: 'Liên hệ với chúng tôi' },
    ],
  },
];

export default function AccountScreen() {
  const { session, user, profile, loading, signOut, isComplete } = useAuth();
  const loggedIn = Boolean(session);
  const name = profile?.full_name || 'Khách Việc Nhanh';
  const phoneLabel = profile?.phone
    ? displayPhone(profile.phone)
    : isPhoneAliasEmail(user?.email)
      ? 'Đăng nhập bằng SĐT'
      : user?.email || '';
  const wallet = formatPrice(profile?.wallet_balance ?? 50000);

  async function handleLogout() {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất để chuyển tài khoản khác?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (err) {
            Alert.alert('Không đăng xuất được', err.message ?? 'Vui lòng thử lại.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Tài khoản</Text>

        {loggedIn ? (
          <View style={styles.profile}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsFromName(name)}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              {phoneLabel ? (
                <Text style={styles.email} numberOfLines={1}>
                  {phoneLabel}
                </Text>
              ) : null}
              <Text style={styles.wallet}>Ví test: {wallet}</Text>
              {!isComplete ? (
                <Text style={styles.warn}>Hồ sơ chưa đủ — hãy bổ sung họ tên và SĐT.</Text>
              ) : null}
            </View>
            <Pressable
              style={styles.editBtn}
              onPress={() =>
                router.push({ pathname: '/(auth)/complete-profile', params: { mode: 'edit' } })
              }>
              <Text style={styles.editText}>Chỉnh sửa</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>Đăng nhập để đăng việc & đấu giá</Text>
            <Text style={styles.guestSub}>
              Dùng số điện thoại + mật khẩu, hoặc Google / Apple. Mỗi tài khoản có ví 50.000 đ để test.
            </Text>
            <Pressable style={styles.primary} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.primaryText}>Đăng nhập</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.secondaryText}>Tạo tài khoản mới</Text>
            </Pressable>
          </View>
        )}

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <Pressable
                key={item.label}
                style={styles.row}
                onPress={() => {
                  if (item.href === '/landing') {
                    router.push('/landing');
                    return;
                  }
                  if (!loggedIn) {
                    router.push('/(auth)/login');
                    return;
                  }
                  if (item.href) {
                    router.push(item.href);
                    return;
                  }
                  Alert.alert(item.label, 'Nội dung này sẽ được bổ sung trong bản sau.');
                }}>
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={18} color={Colors.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
              </Pressable>
            ))}
          </View>
        ))}

        {loggedIn && profile?.is_admin ? (
          <Pressable style={styles.row} onPress={() => router.push('/admin')}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Trang quản trị</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </Pressable>
        ) : null}

        {loggedIn ? (
          <>
            <Pressable style={styles.switchAccount} onPress={handleLogout}>
              <Ionicons name="swap-horizontal-outline" size={18} color={Colors.primary} />
              <Text style={styles.switchText}>Chuyển tài khoản</Text>
            </Pressable>
            <Pressable style={styles.logout} onPress={handleLogout} disabled={loading}>
              <Ionicons name="log-out-outline" size={18} color="#D92D20" />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    paddingTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  profile: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primarySoft,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  email: {
    marginTop: 2,
    color: Colors.textMuted,
    fontSize: 13,
  },
  wallet: {
    marginTop: 4,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  warn: {
    marginTop: 6,
    color: '#B54708',
    fontSize: 12,
    fontWeight: '600',
  },
  editBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  guestCard: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadow.card,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  guestSub: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  secondary: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  switchAccount: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  switchText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  logoutText: {
    color: '#D92D20',
    fontWeight: '800',
    fontSize: 15,
  },
});
