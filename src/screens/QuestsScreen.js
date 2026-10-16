import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import LuckyWheel from '@/components/LuckyWheel';
import MysteryBoxes from '@/components/MysteryBoxes';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import { FALLBACK_WHEEL } from '@/data/luckGames';
import {
  checkInReward,
  claimRewardTask,
  fetchGamePrizes,
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
  const [board, setBoard] = useState({
    tasks: [],
    rewards: [],
    points: 0,
    missing: false,
    checkedInToday: false,
    claims: [],
  });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingReward, setPendingReward] = useState(null);
  const [game, setGame] = useState('');
  const [wheelPrizes, setWheelPrizes] = useState(FALLBACK_WHEEL);
  const generation = useRef(0);
  const userId = session?.user?.id || profile?.id || null;

  const load = useCallback(async () => {
    const token = ++generation.current;
    if (!userId) return null;
    const next = await fetchRewardBoard(userId);
    if (token !== generation.current) return null;
    setBoard(next);
    return next;
  }, [userId]);

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
    if (!userId) {
      Alert.alert('Cần đăng nhập', 'Hãy đăng nhập rồi thử lại.');
      return;
    }
    if (board.checkedInToday) return;
    const token = ++generation.current;
    const before = Number(board.points) || 0;
    setBusy('checkin');
    setNotice('');
    try {
      const result = await checkInReward();
      const gained = Number(result.points) || 0;
      if (token !== generation.current) return;
      setBoard((current) => ({
        ...current,
        checkedInToday: true,
        points: before + gained,
        streak: Math.max(Number(current.streak) || 0, 1),
        tasks: current.tasks.map((task) =>
          task.actionType === 'daily_checkin'
            ? { ...task, status: 'claimed', updatedAt: new Date().toISOString() }
            : task
        ),
      }));
      const next = userId ? await fetchRewardBoard(userId) : null;
      if (token !== generation.current) return;
      if (next) {
        const awaiting = next.tasks.some((task) => task.actionType === 'daily_checkin' && task.status === 'completed');
        setBoard({
          ...next,
          checkedInToday: true,
          points: awaiting ? Number(next.points) || before : Math.max(Number(next.points) || 0, before + gained),
          tasks: next.tasks.map((task) => {
            if (task.actionType !== 'daily_checkin') return task;
            if (task.status === 'completed') return task;
            return { ...task, status: 'claimed' };
          }),
        });
      }
      await refreshProfile();
      const extra = [
        result.lucky_spin ? 'Bạn nhận thêm 1 lượt quay.' : '',
        result.mystery_box ? 'Bạn nhận thêm 1 hộp quà.' : '',
      ].filter(Boolean).join(' ');
      const text = `+${formatPoints(gained)} đã vào số xu của bạn. ${extra}`.trim();
      setNotice(text);
      Alert.alert('Đã điểm danh', text);
    } catch (err) {
      console.log('[rewards] điểm danh thất bại', err);
      const text = err.message || 'Thử lại sau.';
      if (/đã điểm danh/i.test(text)) {
        const next = await fetchRewardBoard(userId);
        if (token === generation.current && next) {
          setBoard({
            ...next,
            checkedInToday: true,
            tasks: next.tasks.map((task) =>
              task.actionType === 'daily_checkin' && task.status !== 'completed'
                ? { ...task, status: 'claimed' }
                : task
            ),
          });
        } else if (token === generation.current) {
          setBoard((current) => ({ ...current, checkedInToday: true }));
        }
        setNotice('Hôm nay bạn đã điểm danh rồi.');
        Alert.alert('Đã điểm danh', 'Hôm nay bạn đã điểm danh rồi.');
      } else {
        setNotice(text);
        Alert.alert('Chưa điểm danh được', text);
      }
    } finally {
      setBusy('');
    }
  }

  async function onClaim(task) {
    if (!userId) {
      Alert.alert('Cần đăng nhập', 'Hãy đăng nhập rồi thử lại.');
      return;
    }
    if (task.status === 'claimed') return;
    const token = ++generation.current;
    const before = Number(board.points) || 0;
    setBusy(task.id);
    setNotice('');
    try {
      const result = await claimRewardTask(task.id);
      const gained = Number(result.points) || 0;
      if (token !== generation.current) return;
      setBoard((current) => ({
        ...current,
        points: before + gained,
        luckySpins: Number(current.luckySpins) + (result.lucky_spin ? 1 : 0),
        mysteryBoxes: Number(current.mysteryBoxes) + (result.mystery_box ? 1 : 0),
        tasks: current.tasks.map((item) => (item.id === task.id ? { ...item, status: 'claimed' } : item)),
      }));
      const next = await fetchRewardBoard(userId);
      if (token === generation.current && next) {
        setBoard({
          ...next,
          points: Math.max(Number(next.points) || 0, before + gained),
          tasks: next.tasks.map((item) => (item.id === task.id ? { ...item, status: 'claimed' } : item)),
        });
      }
      await refreshProfile();
      const extra = [
        result.lucky_spin ? 'Bạn nhận thêm 1 lượt quay.' : '',
        result.mystery_box ? 'Bạn nhận thêm 1 hộp quà.' : '',
      ].filter(Boolean).join(' ');
      const text = `+${formatPoints(gained)} đã vào số xu của bạn. ${extra}`.trim();
      setNotice(text);
      Alert.alert('Đã nhận xu', text);
    } catch (err) {
      console.log('[rewards] nhận xu thất bại', err);
      const text = err.message || 'Thử lại sau.';
      setNotice(text);
      Alert.alert('Chưa nhận được', text);
    } finally {
      setBusy('');
    }
  }

  async function openGame(kind) {
    setBusy(kind);
    try {
      if (kind === 'wheel') {
        const rows = await fetchGamePrizes('wheel');
        setWheelPrizes(rows?.length ? rows : FALLBACK_WHEEL);
      }
      setGame(kind);
    } finally {
      setBusy('');
    }
  }

  async function playLuck(kind) {
    const token = ++generation.current;
    const beforePoints = Number(board.points) || 0;
    const beforeSpins = Number(board.luckySpins) || 0;
    const beforeBoxes = Number(board.mysteryBoxes) || 0;
    const result = kind === 'wheel' ? await spinReward() : await openMysteryBox();
    const nextPoints = Number.isFinite(result.pointsLeft)
      ? result.pointsLeft
      : beforePoints + (result.prizeType === 'coin' ? result.value : 0);
    const nextSpins = kind === 'wheel'
      ? (Number.isFinite(result.turnsLeft) ? result.turnsLeft : Math.max(0, beforeSpins - 1))
      : beforeSpins;
    const nextBoxes = kind === 'box'
      ? (Number.isFinite(result.turnsLeft) ? result.turnsLeft : Math.max(0, beforeBoxes - 1))
      : beforeBoxes;
    if (token === generation.current) {
      setBoard((current) => ({
        ...current,
        points: nextPoints,
        luckySpins: nextSpins,
        mysteryBoxes: nextBoxes,
      }));
    }
    fetchRewardBoard(userId).then((fresh) => {
      if (token !== generation.current || !fresh) return;
      setBoard({
        ...fresh,
        points: Number.isFinite(result.pointsLeft) ? result.pointsLeft : Math.max(Number(fresh.points) || 0, nextPoints),
        luckySpins: kind === 'wheel' ? nextSpins : Number(fresh.luckySpins) || 0,
        mysteryBoxes: kind === 'box' ? nextBoxes : Number(fresh.mysteryBoxes) || 0,
      });
    }).catch(() => {});
    refreshProfile().catch(() => {});
    return result;
  }

  function askRedeem(reward) {
    if (!userId) {
      Alert.alert('Cần đăng nhập', 'Hãy đăng nhập rồi thử lại.');
      return;
    }
    if (reward.stock <= 0) return;
    if (points < reward.pointCost) {
      const text = 'Bạn không đủ xu để đổi quà này!';
      setNotice(text);
      Alert.alert('Chưa đủ xu', text);
      return;
    }
    setPendingReward(reward);
  }

  async function confirmRedeem() {
    const reward = pendingReward;
    if (!reward || !userId) return;
    const token = ++generation.current;
    const before = Number(board.points) || 0;
    setBusy(reward.id);
    setNotice('');
    try {
      if (before < reward.pointCost) {
        throw new Error('Bạn không đủ xu để đổi quà này!');
      }
      if (reward.stock <= 0) {
        throw new Error('Phần thưởng đã hết.');
      }
      const result = await redeemReward(reward.id);
      const nextPoints = Number.isFinite(Number(result.points_left))
        ? Number(result.points_left)
        : Math.max(0, before - reward.pointCost);
      if (token !== generation.current) return;
      setBoard((current) => ({
        ...current,
        points: nextPoints,
        wallet: reward.type === 'app_balance' ? Number(current.wallet || 0) + Number(reward.value || 0) : current.wallet,
        luckySpins: Number(current.luckySpins) + (reward.type === 'lucky_spin' ? 1 : 0),
        mysteryBoxes: Number(current.mysteryBoxes) + (reward.type === 'mystery_box' ? 1 : 0),
        rewards: current.rewards.map((item) =>
          item.id === reward.id ? { ...item, stock: Math.max(0, item.stock - 1) } : item
        ),
        claims: [
          {
            id: result.claim_id || `local-${reward.id}`,
            rewardId: reward.id,
            title: reward.title,
            status: result.status || 'pending',
            createdAt: new Date().toISOString(),
          },
          ...(current.claims || []),
        ],
      }));
      const next = await fetchRewardBoard(userId);
      if (token === generation.current && next) {
        const serverPoints = Number(next.points);
        setBoard({
          ...next,
          points: Number.isFinite(serverPoints) ? Math.min(serverPoints, nextPoints) : nextPoints,
          rewards: next.rewards.map((item) =>
            item.id === reward.id
              ? { ...item, stock: Math.min(item.stock, Math.max(0, reward.stock - 1)) }
              : item
          ),
        });
      }
      await refreshProfile();
      const text = 'Đổi quà thành công! Kiểm tra lịch sử trong mục Quà của tôi';
      setNotice(text);
      setPendingReward(null);
      Alert.alert('Đổi quà thành công', text);
    } catch (err) {
      console.log('Redeem error:', err);
      const text = err.message || 'Thử lại sau.';
      setNotice(text);
      Alert.alert('Chưa đổi được', text);
    } finally {
      setBusy('');
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.note}>Đăng nhập để xem nhiệm vụ và đổi quà.</Text>
      </SafeAreaView>
    );
  }

  const points = board.missing ? Number(profile?.reward_points) || 0 : Number(board.points) || 0;

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
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

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
                        {daily ? (
                          <DailyButton
                            task={task}
                            checkedInToday={board.checkedInToday}
                            busy={busy}
                            onCheckIn={onCheckIn}
                            onClaim={() => onClaim(task)}
                          />
                        ) : (
                          <Pressable
                            style={[styles.btn, !canClaim && styles.btnOff]}
                            disabled={Boolean(busy) || !canClaim}
                            onPress={() => onClaim(task)}>
                            <Text style={[styles.btnText, !canClaim && styles.btnTextOff]}>
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
                <Pressable style={[styles.btn, styles.luckBtn, !board.luckySpins && styles.btnOff]} disabled={Boolean(busy)} onPress={() => openGame('wheel')}>
                  <Text style={[styles.btnText, !board.luckySpins && styles.btnTextOff]}>{busy === 'wheel' ? 'Đang mở...' : `Vòng quay (${board.luckySpins || 0})`}</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.luckBtn, !board.mysteryBoxes && styles.btnOff]} disabled={Boolean(busy)} onPress={() => openGame('box')}>
                  <Text style={[styles.btnText, !board.mysteryBoxes && styles.btnTextOff]}>{busy === 'box' ? 'Đang mở...' : `Hộp quà (${board.mysteryBoxes || 0})`}</Text>
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
                            style={[styles.btn, (soldOut || poor || busy === reward.id) && styles.btnOff]}
                            disabled={Boolean(busy) || soldOut}
                            onPress={() => askRedeem(reward)}>
                            {busy === reward.id ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={[styles.btnText, (soldOut || poor) && styles.btnTextOff]}>
                                {soldOut ? 'Hết hàng' : poor ? 'Chưa đủ xu' : 'Đổi quà'}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Quà của tôi</Text>
                {(board.claims || []).length === 0 ? (
                  <Text style={styles.note}>Bạn chưa đổi quà nào.</Text>
                ) : (
                  (board.claims || []).map((claim) => (
                    <View key={claim.id} style={styles.historyRow}>
                      <View style={styles.body}>
                        <Text style={styles.title}>{claim.title}</Text>
                        <Text style={styles.desc}>{claimStatus(claim.status)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

        {tab === 'tasks' && !board.missing && board.tasks.length === 0 ? (
          <Text style={styles.note}>Chưa có nhiệm vụ nào đang mở.</Text>
        ) : null}
        {tab === 'rewards' && !board.missing && board.rewards.length === 0 ? (
          <Text style={styles.note}>Chưa có phần thưởng nào đang mở.</Text>
        ) : null}
      </ScrollView>
      <Modal visible={Boolean(pendingReward)} transparent animationType="fade" onRequestClose={() => !busy && setPendingReward(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => !busy && setPendingReward(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Đổi quà</Text>
            <Text style={styles.modalBody}>
              Bạn có chắc chắn muốn dùng {formatPoints(pendingReward?.pointCost)} để đổi {pendingReward?.title} không?
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} disabled={Boolean(busy)} onPress={() => setPendingReward(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.modalOk} disabled={Boolean(busy)} onPress={confirmRedeem}>
                {busy === pendingReward?.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnText}>Xác nhận</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {game === 'wheel' ? (
        <LuckyWheel
          prizes={wheelPrizes}
          turns={board.luckySpins || 0}
          onClose={() => setGame('')}
          onSpin={() => playLuck('wheel')}
        />
      ) : null}
      {game === 'box' ? (
        <MysteryBoxes
          turns={board.mysteryBoxes || 0}
          onClose={() => setGame('')}
          onOpen={() => playLuck('box')}
        />
      ) : null}
    </SafeAreaView>
  );
}

function claimStatus(status) {
  if (status === 'completed') return 'Đã nhận';
  if (status === 'rejected') return 'Từ chối';
  return 'Đang xử lý';
}

function DailyButton({ task, checkedInToday, busy, onCheckIn, onClaim }) {
  const awaitingCoins = checkedInToday && task.status === 'completed';
  const done = checkedInToday && !awaitingCoins;
  const label = done
    ? 'Đã điểm danh'
    : awaitingCoins
      ? (busy === task.id ? 'Đang nhận...' : 'Nhận xu')
      : (busy === 'checkin' ? 'Đang điểm danh...' : 'Điểm danh');
  return (
    <Pressable
      style={[styles.btn, done && styles.btnOff]}
      disabled={Boolean(busy) || done}
      onPress={awaitingCoins ? onClaim : onCheckIn}>
      <Text style={[styles.btnText, done && styles.btnTextOff]}>{label}</Text>
    </Pressable>
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
  notice: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
    color: Colors.text,
    fontWeight: '700',
  },
  historyRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalBody: { color: Colors.text, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontWeight: '800', color: Colors.text },
  modalOk: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  btnOff: {
    backgroundColor: '#CBD5E1',
    opacity: 0.7,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
  btnTextOff: { color: '#475467' },
});
