import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import { claimQuest, dailyCheckin, fetchQuests } from '@/services/quests';

export default function QuestsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [quests, setQuests] = useState([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const rows = await fetchQuests(profile?.id);
    setQuests(rows);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  async function onDaily() {
    setBusy('daily');
    try {
      const amount = await dailyCheckin();
      await refreshProfile();
      await load();
      Alert.alert('Điểm danh thành công', `Bạn vừa nhận ${formatPrice(amount)} vào ví.`);
    } catch (err) {
      Alert.alert('Chưa điểm danh được', err.message ?? 'Thử lại sau.');
    } finally {
      setBusy('');
    }
  }

  async function onClaim(slug) {
    setBusy(slug);
    try {
      const amount = await claimQuest(slug);
      await refreshProfile();
      await load();
      Alert.alert('Đã nhận quà', `+${formatPrice(amount)} đã vào ví Việc Nhanh.`);
    } catch (err) {
      Alert.alert('Chưa nhận được', err.message ?? 'Chạy SQL nhiệm vụ rồi thử lại.');
    } finally {
      setBusy('');
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.note}>Đăng nhập để xem nhiệm vụ và nhận quà.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Làm nhiệm vụ, nhận xu</Text>
          <Text style={styles.heroSub}>
            Ví hiện tại {formatPrice(profile?.wallet_balance ?? 0)}. Hoàn thành việc nhỏ mỗi ngày để
            tăng số dư.
          </Text>
        </View>

        {quests.map((quest) => {
          const daily = quest.kind === 'daily';
          const canClaim = quest.completed && !quest.claimed;
          const ratio = Math.min(1, (quest.progress || 0) / (quest.requirementCount || 1));
          return (
            <View key={quest.slug} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.icon}>
                  <Ionicons
                    name={daily ? 'calendar-outline' : 'trophy-outline'}
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{quest.title}</Text>
                  <Text style={styles.desc}>{quest.description}</Text>
                </View>
                <Text style={styles.reward}>+{formatPrice(quest.rewardAmount)}</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <Text style={styles.progress}>
                {daily
                  ? quest.claimed
                    ? 'Hôm nay đã điểm danh'
                    : 'Chưa điểm danh hôm nay'
                  : `${quest.progress}/${quest.requirementCount}`}
              </Text>
              {daily ? (
                <Pressable
                  style={[styles.btn, quest.claimed && styles.btnOff]}
                  disabled={Boolean(busy) || quest.claimed}
                  onPress={onDaily}>
                  <Text style={styles.btnText}>
                    {quest.claimed ? 'Mai quay lại' : busy === 'daily' ? 'Đang điểm danh...' : 'Điểm danh'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.btn, !canClaim && styles.btnOff]}
                  disabled={Boolean(busy) || !canClaim}
                  onPress={() => onClaim(quest.slug)}>
                  <Text style={styles.btnText}>
                    {quest.claimed
                      ? 'Đã nhận'
                      : canClaim
                        ? busy === quest.slug
                          ? 'Đang nhận...'
                          : 'Nhận quà'
                        : 'Chưa đủ điều kiện'}
                  </Text>
                </Pressable>
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
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  note: { padding: 20, color: Colors.textMuted },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadow.card,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: '#D6E4FF', marginTop: 6, lineHeight: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
    ...Shadow.soft,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontWeight: '800', color: Colors.text, fontSize: 16 },
  desc: { color: Colors.textMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  reward: { fontWeight: '800', color: Colors.success, fontSize: 12 },
  bar: {
    height: 8,
    borderRadius: 8,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  barFill: { height: 8, backgroundColor: Colors.primary },
  progress: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOff: { backgroundColor: '#D0D5DD' },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
});
