import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import BidCard from '@/components/BidCard';
import UserIdentityCard from '@/components/UserIdentityCard';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useJobs } from '@/context/JobsContext';
import { useUnread } from '@/context/UnreadContext';
import { getCategoryById } from '@/data/categories';
import {
  BID_FEE,
  JOB_STATUS,
  formatPrice,
  isJobLive,
  jobFlowStatus,
  offerLabel,
  questionLabel,
  statusLabel,
  viewLabel,
} from '@/data/jobs';
import { formatArea } from '@/data/locations';
import { getOrCreateConversation } from '@/services/chat';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getJobById, addQuote, loadJob, trackJobView, profile, loading, closeJob } = useJobs();
  const { markJobBidsSeen } = useUnread();
  const job = getJobById(id);
  const jobId = job?.id;
  const jobOwnerId = job?.userId;
  const profileId = profile?.id;

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    loadJob(String(id)).catch(() => {});
  }, [id, loadJob]);

  useEffect(() => {
    if (!job?.id) return;
    trackJobView(job.id).catch(() => {});
  }, [job?.id, profile?.id, trackJobView]);

  useFocusEffect(
    useCallback(() => {
      if (jobId) loadJob(String(jobId)).catch(() => {});
      if (!jobId || !profileId || jobOwnerId !== profileId) return undefined;
      markJobBidsSeen(jobId)
        .then((count) => {
          if (count > 0) return loadJob(String(jobId));
          return null;
        })
        .catch(() => {});
      return undefined;
    }, [jobId, jobOwnerId, loadJob, markJobBidsSeen, profileId])
  );

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        {loading ? (
          <ActivityIndicator style={styles.missing} color={Colors.primary} />
        ) : (
          <Text style={styles.missing}>Không tìm thấy tin đăng.</Text>
        )}
      </SafeAreaView>
    );
  }

  const category = getCategoryById(job.categoryId);
  const flowStatus = jobFlowStatus(job);
  const isPending = flowStatus === JOB_STATUS.PENDING;
  const isOpen = isJobLive(job);
  const isAssigned = flowStatus === JOB_STATUS.ASSIGNED;
  const isCompleted = flowStatus === JOB_STATUS.COMPLETED;
  const isCancelled = flowStatus === JOB_STATUS.CLOSED;
  const questions = job.questions ?? 0;
  const isOwner = Boolean(profile?.id && job.userId === profile.id);
  const alreadyBid = Boolean(
    profile?.id && (job.quotes || []).some((quote) => quote.workerId === profile.id)
  );

  async function sendQuote() {
    if (!amount.trim()) {
      Alert.alert('Thiếu đề xuất', 'Vui lòng nhập số tiền.');
      return;
    }
    if (isOwner) {
      Alert.alert('Không gửi được', 'Bạn không thể báo giá tin của chính mình.');
      return;
    }
    if (alreadyBid) {
      Alert.alert('Đã gửi đề xuất', 'Mỗi thợ chỉ được đề xuất 1 lần cho mỗi tin đăng.');
      return;
    }
    setSending(true);
    try {
      await addQuote(job.id, { amount, note });
      setQuoteOpen(false);
      setAmount('');
      setNote('');
      Alert.alert(
        'Đã gửi đề xuất',
        `Đã trừ ${formatPrice(BID_FEE)} phí gửi đề xuất. Người đăng việc sẽ thấy đề xuất của bạn.`
      );
    } catch (err) {
      if (err.code === 'AUTH_REQUIRED') {
        router.push({ pathname: '/(auth)/login', params: { redirect: `/job/${job.id}` } });
        return;
      }
      if (err.code === 'BID_EXISTS') {
        setQuoteOpen(false);
        Alert.alert('Đã gửi đề xuất', err.message);
        return;
      }
      Alert.alert('Không gửi được đề xuất', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  function confirmCloseJob() {
    Alert.alert('Gỡ tin đăng', 'Tin sẽ chuyển sang Đã huỷ và không còn hiện trên Khám phá.', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Gỡ tin',
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try {
            await closeJob(job.id);
          } catch (err) {
            Alert.alert('Không gỡ được tin', err.message ?? 'Vui lòng thử lại.');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  }

  async function openQuoteChat(quote) {
    const canOpen = isOwner || quote.workerId === profile?.id;
    if (!canOpen) return;
    if (!profile?.id) {
      router.push({ pathname: '/(auth)/login', params: { redirect: `/job/${job.id}` } });
      return;
    }
    setOpeningChat(true);
    try {
      const conversation = await getOrCreateConversation(job.id, quote.workerId);
      if (!conversation?.id) {
        throw new Error('Không tìm thấy cuộc trò chuyện.');
      }
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: String(conversation.id),
          jobId: String(job.id),
          workerId: String(quote.workerId),
        },
      });
    } catch (err) {
      Alert.alert('Không mở được chat', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {isPending ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingTitle}>Tin đang chờ duyệt</Text>
            <Text style={styles.pendingMeta}>
              Tin này chưa được duyệt nên chưa hiện trên trang chủ.
            </Text>
          </View>
        ) : null}

        {isAssigned ? (
          <View style={styles.assignedBanner}>
            <Text style={styles.assignedTitle}>Đã nhận</Text>
            <Text style={styles.assignedMeta}>
              {isOwner
                ? 'Bạn đã thuê thợ. Có thể hủy thuê trong chat để chọn người khác, hoặc thanh toán để hoàn thành.'
                : 'Công việc này đã có thợ nhận.'}
            </Text>
          </View>
        ) : null}

        {isCompleted ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedTitle}>Hoàn thành</Text>
            <Text style={styles.completedMeta}>Công việc đã thanh toán và kết thúc.</Text>
          </View>
        ) : null}

        {isCancelled ? (
          <View style={styles.cancelBanner}>
            <Text style={styles.cancelTitle}>Công việc này đã đóng</Text>
            <Text style={styles.cancelMeta}>
              Tin đăng đã đóng, không còn nhận đề xuất mới.
            </Text>
            <Pressable style={styles.repost} onPress={() => router.push({
              pathname: '/create',
              params: { title: job.title, categoryId: job.categoryId },
            })}>
              <Text style={styles.repostText}>Đăng lại việc này</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.top}>
            <Text style={styles.title}>{job.title}</Text>
          </View>
          {category ? <Text style={styles.category}>{category.name}</Text> : null}

          <Text style={styles.budgetLabel}>Ngân sách</Text>
          <Text style={styles.price}>{formatPrice(job.price)}</Text>

          <View style={styles.stats}>
            <Text style={styles.stat}>{statusLabel(flowStatus)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.stat}>{viewLabel(job.views)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.stat}>{offerLabel(job.quotes.length)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.stat}>{questionLabel(questions)}</Text>
          </View>

          {job.poster?.id ? (
            <View style={styles.posterBlock}>
              <Text style={styles.posterLabel}>Người đăng</Text>
              <UserIdentityCard
                compact
                user={job.poster}
                onPress={() =>
                  router.push({ pathname: '/user/[id]', params: { id: String(job.poster.id) } })
                }
              />
            </View>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>{formatArea(job.provinceId, job.wardId)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>{job.dateLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="eye-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>{viewLabel(job.views)} từ tài khoản đã đăng nhập</Text>
          </View>
        </View>

        <Text style={styles.section}>Mô tả công việc</Text>
        <Text style={styles.description}>{job.description}</Text>

        <Text style={styles.section}>Đề xuất ({job.quotes.length})</Text>
        {job.quotes.length === 0 ? (
          <Text style={styles.emptyQuote}>Chưa có đề xuất. Hãy là người đầu tiên!</Text>
        ) : (
          job.quotes.map((quote) => (
            <BidCard
              key={quote.id}
              quote={quote}
              showNew={isOwner && !quote.seenByPoster}
              hired={job.hiredBidId === quote.id || job.hiredWorkerId === quote.workerId}
              onPress={
                !openingChat && (isOwner || quote.workerId === profile?.id)
                  ? () => openQuoteChat(quote)
                  : undefined
              }
            />
          ))
        )}

        {isOwner && (isPending || isOpen) ? (
          <Pressable style={styles.closeBtn} onPress={confirmCloseJob} disabled={closing}>
            {closing ? (
              <ActivityIndicator color="#B42318" />
            ) : (
              <Text style={styles.closeBtnText}>Gỡ tin đăng</Text>
            )}
          </Pressable>
        ) : null}

        <View style={styles.policy}>
          <Text style={styles.policyTitle}>Điều gì xảy ra khi công việc bị hủy</Text>
          <Text style={styles.policyText}>
            Nếu bạn chịu trách nhiệm hủy công việc này, phí hủy có thể bị trừ vào khoản thanh toán tiếp theo của bạn.
          </Text>
          <Pressable>
            <Text style={styles.learnMore}>Tìm hiểu thêm</Text>
          </Pressable>
        </View>
      </ScrollView>

      {!isOwner && alreadyBid ? (
        <Pressable
          style={styles.cta}
          onPress={() => {
            const mine = (job.quotes || []).find((quote) => quote.workerId === profile?.id);
            if (mine) openQuoteChat(mine);
          }}
          disabled={openingChat}>
          {openingChat ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>Mở tin nhắn</Text>
          )}
        </Pressable>
      ) : isOpen && !isOwner ? (
        <Pressable style={styles.cta} onPress={() => setQuoteOpen(true)}>
          <Text style={styles.ctaText}>Gửi đề xuất ngay</Text>
        </Pressable>
      ) : null}

      <Modal visible={quoteOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setQuoteOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Gửi đề xuất</Text>
            <Text style={styles.feeHint}>Phí gửi đề xuất: {formatPrice(BID_FEE)} (trừ vào ví)</Text>
            <TextInput
              style={styles.input}
              placeholder="Số tiền đề xuất (VNĐ)"
              placeholderTextColor={Colors.textLight}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Ghi chú ngắn (không bắt buộc)"
              placeholderTextColor={Colors.textLight}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Pressable style={[styles.cta, { margin: 0 }]} onPress={sendQuote} disabled={sending}>
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>Gửi đề xuất</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  pendingBanner: {
    backgroundColor: '#FFFAEB',
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B54708',
  },
  pendingMeta: {
    marginTop: 6,
    color: '#93370D',
    lineHeight: 20,
  },
  assignedBanner: {
    backgroundColor: Colors.assignedSoft,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  assignedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.assigned,
  },
  assignedMeta: {
    marginTop: 6,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  completedBanner: {
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.success,
  },
  completedMeta: {
    marginTop: 6,
    color: Colors.success,
    lineHeight: 20,
  },
  cancelBanner: {
    backgroundColor: '#FEF3F2',
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  cancelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B42318',
  },
  cancelMeta: {
    marginTop: 6,
    color: '#912018',
    lineHeight: 20,
  },
  repost: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  repostText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadow.card,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  budgetLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  price: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  category: {
    marginTop: 8,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  posterBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  posterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  stat: {
    fontWeight: '700',
    color: Colors.primary,
    fontSize: 13,
  },
  dot: {
    color: Colors.textLight,
  },
  infoCard: {
    marginTop: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  emptyQuote: {
    color: Colors.textMuted,
  },
  closeBtn: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#FDA29B',
    backgroundColor: '#FEF3F2',
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#B42318',
    fontWeight: '800',
    fontSize: 15,
  },
  policy: {
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  policyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  learnMore: {
    marginTop: 8,
    color: Colors.primary,
    fontWeight: '700',
  },
  cta: {
    margin: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaDisabled: {
    backgroundColor: Colors.assigned,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  feeHint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  missing: {
    padding: 24,
    textAlign: 'center',
    color: Colors.textMuted,
  },
});
