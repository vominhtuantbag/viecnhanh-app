import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { SITE } from '@/constants/site';
import { CATEGORIES } from '@/data/categories';

const STEPS = [
  { icon: 'create-outline', title: 'Đăng việc 30 giây', body: 'Mô tả việc, chọn khu vực, đưa giá.' },
  { icon: 'people-outline', title: 'Thợ gần nhà báo giá', body: 'So sánh đề xuất, xem đánh giá thật.' },
  { icon: 'checkmark-done-outline', title: 'Thuê và hoàn thành', body: 'Chat, gọi, xác nhận xong việc.' },
];

export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="flash" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>{SITE.name}</Text>
          </View>
          <View style={styles.navRight}>
            <Pressable onPress={() => router.push('/(tabs)/browse')}>
              <Text style={styles.navLink}>Vào ứng dụng</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => router.push('/admin')}>
              <Text style={styles.navBtnText}>Admin</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Ứng dụng việc lặt vặt tại Việt Nam</Text>
            <Text style={styles.h1}>{SITE.tagline}</Text>
            <Text style={styles.lead}>{SITE.description}</Text>
            <View style={styles.ctaRow}>
              <Pressable style={styles.cta} onPress={() => Linking.openURL(SITE.playStoreUrl)}>
                <Ionicons name="logo-google-playstore" size={18} color="#FFFFFF" />
                <Text style={styles.ctaText}>Tải Android</Text>
              </Pressable>
              <Pressable style={styles.ctaGhost} onPress={() => Linking.openURL(SITE.appStoreUrl)}>
                <Ionicons name="logo-apple" size={18} color={Colors.primary} />
                <Text style={styles.ctaGhostText}>Tải iOS</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.phone}>
            <Text style={styles.phoneKicker}>Trong app</Text>
            <Text style={styles.phoneTitle}>Khám phá việc gần bạn</Text>
            {['Dọn nhà 250.000 đ', 'Sửa vòi nước 180.000 đ', 'Giao hàng gấp 80.000 đ'].map((line) => (
              <View key={line} style={styles.fakeCard}>
                <Text style={styles.fakeCardText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.h2}>Làm sao để bắt đầu</Text>
        <View style={[styles.grid, wide && styles.grid3]}>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={step.icon} size={22} color={Colors.primary} />
              </View>
              <Text style={styles.featureTitle}>{step.title}</Text>
              <Text style={styles.featureBody}>{step.body}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Nhóm việc phổ biến</Text>
        <View style={styles.chips}>
          {CATEGORIES.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.chip}>
              <Text style={styles.chipText}>{item.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>{SITE.name}</Text>
          <Text style={styles.footerMeta}>{SITE.supportEmail}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  page: { padding: 20, paddingBottom: 48, maxWidth: 1080, width: '100%', alignSelf: 'center' },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontWeight: '800', fontSize: 18, color: Colors.text },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  navLink: { fontWeight: '700', color: Colors.textMuted },
  navBtn: {
    backgroundColor: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  navBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  hero: { gap: 20, marginBottom: 36 },
  heroWide: { flexDirection: 'row', alignItems: 'center' },
  heroCopy: { flex: 1, gap: 12 },
  eyebrow: { color: Colors.primary, fontWeight: '800', textTransform: 'uppercase', fontSize: 12 },
  h1: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -0.8, lineHeight: 44 },
  lead: { color: Colors.textMuted, fontSize: 16, lineHeight: 24, maxWidth: 520 },
  ctaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 8 },
  cta: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#FFFFFF', fontWeight: '800' },
  ctaGhost: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctaGhostText: { color: Colors.primary, fontWeight: '800' },
  phone: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 20,
    minHeight: 280,
    ...Shadow.card,
  },
  phoneKicker: { color: '#D6E4FF', fontWeight: '700' },
  phoneTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  fakeCard: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  fakeCardText: { color: '#FFFFFF', fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 14, marginTop: 8 },
  grid: { gap: 12, marginBottom: 28 },
  grid3: { flexDirection: 'row' },
  feature: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.soft,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: { fontWeight: '800', color: Colors.text, marginBottom: 4 },
  featureBody: { color: Colors.textMuted, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 36 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontWeight: '700', color: Colors.text },
  footer: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16 },
  footerBrand: { fontWeight: '800', color: Colors.text },
  footerMeta: { color: Colors.textMuted, marginTop: 4 },
});
