import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import {
  checkInReward,
  claimRewardTask,
  fetchRewardBoard,
  openMysteryBox,
  recordRewardAction,
  redeemReward,
  spinReward,
} from '@/services/rewards';

const TYPE_LABEL = {
  phone_card: 'Thẻ cào',
  voucher: 'Mã giảm giá',
  app_balance: 'Cộng ví',
  physical_gift: 'Quà hiện vật',
  data_4g: 'Data 4G',
  partner_voucher: 'Voucher đối tác',
  badge: 'Huy hiệu',
  boost: 'Lượt đẩy tin',
  lucky_spin: 'Vòng quay',
  mystery_box: 'Hộp quà',
};

const TASK_GROUPS = [
  { key: 'daily', label: 'Điểm danh & thói quen' },
  { key: 'explore', label: 'Khám phá & lan tỏa' },
  { key: 'core', label: 'Việc làm thật' },
  { key: 'referral', label: 'Giới thiệu bạn bè' },
];

const REWARD_GROUPS = [
  { key: 'wallet', label: 'Tiền vào ví' },
  { key: 'perk', label: 'Đặc quyền công việc' },
  { key: 'life', label: 'Thẻ cào & voucher' },
  { key: 'luck', label: 'Vòng quay & hộp quà' },
];

function formatPoints(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} xu`;
}

export default function QuestsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState('tasks');
  const [board, setBoard] = useState({ tasks: [], rewards: [], points: 0, missing: false });
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const next = await fetchRewardBoard(profile?.id);
    setBoard(next);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      recordRewardAction('golden_hour')
        .catch(() => {})
        .finally(() => {
          load().catch(() => {});
        });
    }, [load])
  );

  async function onCheckIn() {
    setBusy('checkin');
    try {
      await checkInReward();
      await load();
      Alert.alert('Đã điểm danh', 'Tiến độ nhiệm vụ điểm danh đã được cộng.');
    } catch (err) {
      Alert.alert('Chưa điểm danh được', err.message || 'Thử lại sau.');
    } finally {
      setBusy('');
    }
  }

  async function onClaim(task) {
    setBusy(task.id);
    try {
      const result = await claimRewardTask(task.id);
      await refreshProfile();
      await load();
      const extra = [
        result.lucky_spin ? 'Bạn nhận thêm 1 lượt quay.' : '',
        result.mystery_box ? 'Bạn nhận thêm 1 hộp quà.' : '',
      ].filter(Boolean).join(' ');
      Alert.alert('Đã nhận xu', `+${formatPoints(result.points)} đã vào số xu của bạn. ${extra}`.trim());
    } catch (err) {
      Alert.alert('Chưa nhận được', err.message || 'Thử lại sau.');
    } finally {
      setBusy('');
    }
  }

  async function onSpin() {
    setBusy('spin');
    try {
      const prize = await spinReward();
      await refreshProfile();
      await load();
      Alert.alert('Vòng quay', `Bạn nhận được ${formatPoints(prize)}.`);
    } catch (err) {
      Alert.alert('Chưa quay được', err.message || 'Thử lại sau.');
    } finally {
      setBusy('');
    }
  }

  async function onOpenBox() {
    setBusy('box');
    try {
      const prize = await openMysteryBox();
      await refreshProfile();
      await load();
      Alert.alert('Hộp quà', `Bạn nhận được ${formatPoints(prize)}.`);
    } catch (err) {
      Alert.alert('Chưa mở được', err.message || 'Thử lại sau.');
    } finally {
      setBusy('');
    }
  }

  function onRedeem(reward) {
    Alert.alert('Đổi quà', `Dùng ${formatPoints(reward.pointCost)} để đổi “${reward.title}”?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đổi ngay',
        onPress: async () => {
          setBusy(reward.id);
          try {
            const result = await redeemReward(reward.id);
            await refreshProfile();
            await load();
            if (result.status === 'completed' && reward.type === 'app_balance') {
              Alert.alert('Đã cộng ví', `${formatPrice(reward.value)} đã vào ví.`);
            } else if (result.status === 'completed' && reward.type === 'lucky_spin') {
              Alert.alert('Đã nhận lượt quay', 'Bạn có thể bấm Quay ngay ở đầu mục đổi quà.');
            } else if (result.status === 'completed' && reward.type === 'mystery_box') {
              Alert.alert('Đã nhận hộp quà', 'Bạn có thể bấm Mở hộp ở đầu mục đổi quà.');
            } else if (result.status === 'completed' && reward.type === 'badge') {
              Alert.alert('Đã nhận huy hiệu', 'Huy hiệu đã gắn vào hồ sơ của bạn.');
            } else if (result.status === 'completed' && reward.type === 'boost') {
              Alert.alert('Đã nhận lượt đẩy tin', 'Lượt đẩy tin đã được cộng.');
            } else if (result.claim_code) {
              Alert.alert('Đổi thành công', `Mã của bạn: ${result.claim_code}`);
            } else {
              Alert.alert('Đã gửi yêu cầu', 'Quản trị sẽ gửi mã thẻ hoặc voucher cho bạn.');
            }
          } catch (err) {
            Alert.alert('Chưa đổi được', err.message || 'Thử lại sau.');
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.note}>Đăng nhập để xem nhiệm vụ và đổi quà.</Text>
      </SafeAreaView>
    );
  }

  const points = board.points || Number(profile?.reward_points) || 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Xu của bạn</Text>
          <Text style={styles.heroPoints}>{formatPoints(points)}</Text>
          <Text style={styles.heroSub}>Ví tiền {formatPrice(profile?.wallet_balance ?? board.wallet ?? 0)}</Text>
          <Text style={styles.heroSub}>
            Chuỗi {board.streak || 0} ngày · {board.luckySpins || 0} lượt quay · {board.mysteryBoxes || 0} hộp quà
          </Text>
        </View>

        <View style={styles.tabs}>
          <TabButton label="Nhiệm vụ" on={tab === 'tasks'} onPress={() => setTab('tasks')} />
          <TabButton label="Đổi phần thưởng" on={tab === 'rewards'} onPress={() => setTab('rewards')} />
        </View>

        {board.missing ? (
          <Text style={styles.note}>
            Kho nhiệm vụ chưa sẵn sàng. Quản trị cần chạy file SQL nhiệm vụ một lần.
          </Text>
        ) : null}

        {tab === 'tasks'
          ? TASK_GROUPS.map((group) => {
              const items = board.tasks.filter((task) => (task.groupKey || 'core') === group.key);
              if (!items.length) return null;
              return (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.label}</Text>
                  {items.map((task) => {
                    const ratio = Math.min(1, task.currentCount / (task.targetCount || 1));
                    const canClaim = task.status === 'completed';
                    const claimed = task.status === 'claimed';
                    const daily = task.actionType === 'daily_checkin';
                    return (
                      <View key={task.id} style={styles.card}>
                        <View style={styles.cardTop}>
                          <View style={styles.icon}>
                            <Ionicons name={daily ? 'calendar-outline' : 'trophy-outline'} size={20} color={Colors.primary} />
                          </View>
                          <View style={styles.body}>
                            <Text style={styles.title}>{task.title}</Text>
                            <Text style={styles.desc}>{task.description}</Text>
                          </View>
                          <Text style={styles.reward}>+{formatPoints(task.rewardPoints)}</Text>
                        </View>
                        <View style={styles.bar}>
                          <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
                        </View>
                        <Text style={styles.progress}>
                          {task.currentCount}/{task.targetCount}
                        </Text>
                        {daily && !canClaim ? (
                          <Pressable style={styles.btn} disabled={Boolean(busy)} onPress={onCheckIn}>
                            <Text style={styles.btnText}>{busy === 'checkin' ? 'Đang điểm danh...' : 'Điểm danh'}</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.btn, !canClaim && styles.btnOff]}
                            disabled={Boolean(busy) || !canClaim}
                            onPress={() => onClaim(task)}>
                            <Text style={styles.btnText}>
                              {claimed ? 'Đã nhận' : canClaim ? (busy === task.id ? 'Đang nhận...' : 'Nhận xu') : 'Chưa đủ điều kiện'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })
          : (
            <>
              <View style={styles.luckRow}>
                <Pressable style={[styles.btn, styles.luckBtn, !board.luckySpins && styles.btnOff]} disabled={Boolean(busy) || !board.luckySpins} onPress={onSpin}>
                  <Text style={styles.btnText}>{busy === 'spin' ? 'Đang quay...' : `Quay ngay (${board.luckySpins || 0})`}</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.luckBtn, !board.mysteryBoxes && styles.btnOff]} disabled={Boolean(busy) || !board.mysteryBoxes} onPress={onOpenBox}>
                  <Text style={styles.btnText}>{busy === 'box' ? 'Đang mở...' : `Mở hộp (${board.mysteryBoxes || 0})`}</Text>
                </Pressable>
              </View>
              {REWARD_GROUPS.map((group) => {
                const items = board.rewards.filter((reward) => (reward.groupKey || 'wallet') === group.key);
                if (!items.length) return null;
                return (
                  <View key={group.key} style={styles.group}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    {items.map((reward) => {
                      const soldOut = reward.stock <= 0;
                      const poor = points < reward.pointCost;
                      return (
                        <View key={reward.id} style={styles.card}>
                          <View style={styles.cardTop}>
                            <View style={styles.icon}>
                              <Ionicons name="gift-outline" size={20} color={Colors.primary} />
                            </View>
                            <View style={styles.body}>
                              <Text style={styles.title}>{reward.title}</Text>
                              <Text style={styles.desc}>
                                {TYPE_LABEL[reward.type] || 'Quà'}
                                {reward.value ? ` · trị giá ${formatPrice(reward.value)}` : ''} · còn {reward.stock}
                              </Text>
                            </View>
                            <Text style={styles.reward}>{formatPoints(reward.pointCost)}</Text>
                          </View>
                          <Pressable
                            style={[styles.btn, (soldOut || poor) && styles.btnOff]}
                            disabled={Boolean(busy) || soldOut || poor}
                            onPress={() => onRedeem(reward)}>
                            <Text style={styles.btnText}>
                              {soldOut ? 'Hết quà' : poor ? 'Chưa đủ xu' : busy === reward.id ? 'Đang đổi...' : 'Đổi ngay'}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}

        {tab === 'tasks' && !board.missing && board.tasks.length === 0 ? (
          <Text style={styles.note}>Chưa có nhiệm vụ nào đang mở.</Text>
        ) : null}
        {tab === 'rewards' && !board.missing && board.rewards.length === 0 ? (
          <Text style={styles.note}>Chưa có phần thưởng nào đang mở.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, on, onPress }) {
  return (
    <Pressable style={[styles.tab, on && styles.tabOn]} onPress={onPress}>
      <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  note: { color: Colors.textMuted, lineHeight: 20 },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadow.card,
  },
  heroLabel: { color: '#D6E4FF', fontWeight: '700' },
  heroPoints: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 4 },
  heroSub: { color: '#D6E4FF', marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabOn: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  tabText: { fontWeight: '800', color: Colors.textMuted },
  tabTextOn: { color: Colors.primary },
  group: { gap: 12 },
  groupTitle: { fontWeight: '800', color: Colors.text, fontSize: 15, marginTop: 4 },
  luckRow: { flexDirection: 'row', gap: 8 },
  luckBtn: { flex: 1 },
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
  bar: { height: 8, borderRadius: 8, backgroundColor: Colors.border, overflow: 'hidden' },
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
