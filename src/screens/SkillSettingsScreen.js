import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { ACHIEVEMENT_TABS } from '@/data/achievements';
import { claimAchievement, loadAchievements } from '@/services/achievements';

export default function SkillSettingsScreen() {
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    const board = await loadAchievements(profile.id, profile);
    setItems(board.items);
    setMissing(board.missing);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return undefined;
      if (!session) {
        router.replace('/(auth)/login');
        return undefined;
      }
      load().catch(() => setLoading(false));
      return undefined;
    }, [authLoading, load, session])
  );

  async function onClaim(item) {
    setBusy(item.id);
    try {
      await claimAchievement(profile.id, item);
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, claimed: true } : row)));
      await refreshProfile().catch(() => {});
      Alert.alert('Đã nhận thưởng', `Bạn nhận ${item.rewardCoins} xu và danh hiệu ${item.badgeName}.`);
    } catch (err) {
      Alert.alert('Chưa nhận được', err.message || 'Vui lòng thử lại.');
    } finally {
      setBusy('');
    }
  }

  const visible = tab === 'all' ? items : items.filter((item) => item.category === tab);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.top}>
        <Text style={styles.lead}>Mốc dài hạn, khác với nhiệm vụ hàng ngày.</Text>
        <View style={styles.tabs}>
          {ACHIEVEMENT_TABS.map((item, index) => {
            const on = tab === item.id;
            const last = index === ACHIEVEMENT_TABS.length - 1;
            return (
              <Pressable
                key={item.id}
                style={[styles.tab, last && styles.tabLast, on && styles.tabOn]}
                onPress={() => setTab(item.id)}>
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {missing ? (
          <Text style={styles.note}>Danh sách mẫu đang hiện. Để nhận thưởng thật, quản trị chạy file SQL thành tựu một lần.</Text>
        ) : null}
        {loading ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : null}
        {!loading && visible.length === 0 ? <Text style={styles.note}>Chưa có thành tựu trong nhóm này.</Text> : null}
        {visible.map((item) => {
          const target = item.targetCount || 1;
          const ratio = Math.min(1, item.current / target);
          const ready = item.current >= target && !item.claimed;
          const iconUrl = /^https?:/i.test(item.iconUrl || '');
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.icon}>
                  {iconUrl ? (
                    <Image source={{ uri: item.iconUrl }} style={styles.iconImage} contentFit="contain" />
                  ) : (
                    <Ionicons name={item.iconUrl || 'trophy-outline'} size={22} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.badge}>{item.badgeName}</Text>
                  <Text style={styles.desc}>{item.description}</Text>
                </View>
                <Text style={styles.reward}>+{item.rewardCoins} xu</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <Text style={styles.progress}>
                {item.current}/{target}
              </Text>
              {item.claimed ? (
                <View style={[styles.claim, styles.claimDone]}>
                  <Text style={styles.claimDoneText}>Đã nhận</Text>
                </View>
              ) : ready ? (
                <Pressable style={styles.claim} disabled={Boolean(busy)} onPress={() => onClaim(item)}>
                  {busy === item.id ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.claimText}>Nhận thưởng</Text>
                  )}
                </Pressable>
              ) : (
                <View style={[styles.claim, styles.claimWait]}>
                  <Text style={styles.claimWaitText}>Chưa đạt</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  top: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: Colors.background,
  },
  lead: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  tabs: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 52,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  tabLast: { borderRightWidth: 0 },
  tabOn: { backgroundColor: Colors.primary },
  tabText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  tabTextOn: { color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  note: { color: Colors.textMuted, lineHeight: 20 },
  loader: { marginVertical: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.soft,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: { width: 24, height: 24 },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: '800', color: Colors.text, fontSize: 16 },
  badge: { marginTop: 2, color: Colors.primary, fontWeight: '700', fontSize: 12 },
  desc: { marginTop: 4, color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  reward: { color: Colors.success, fontWeight: '800', fontSize: 12 },
  bar: { height: 8, borderRadius: 8, backgroundColor: Colors.border, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: Colors.primary },
  progress: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  claim: {
    minHeight: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimText: { color: '#FFFFFF', fontWeight: '800' },
  claimDone: { backgroundColor: Colors.successSoft },
  claimDoneText: { color: Colors.success, fontWeight: '800' },
  claimWait: { backgroundColor: Colors.assignedSoft },
  claimWaitText: { color: Colors.textMuted, fontWeight: '800' },
});
