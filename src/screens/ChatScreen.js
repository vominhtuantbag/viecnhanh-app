import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useJobs } from '@/context/JobsContext';
import { useUnread } from '@/context/UnreadContext';
import StarRow from '@/components/StarRow';
import { formatPrice, HIRE_CANCEL_REASONS, JOB_STATUS, jobFlowStatus } from '@/data/jobs';
import { displayPhone, parseVnPhone } from '@/lib/phone';
import {
  asConversationId,
  fetchConversationById,
  fetchConversationByJobAndWorker,
  fetchMessages,
  getOrCreateConversation,
  mapConversation,
  otherParty,
  posterHasMessaged,
  sendChatMessage,
  subscribeMessages,
} from '@/services/chat';
import { fetchMyReviewForJob, submitJobReview } from '@/services/jobs';
import {
  mergeMessages,
  readCachedConversation,
  readCachedMessages,
  writeCachedMessages,
} from '@/lib/chat-cache';
import { initialsFromName } from '@/services/profiles';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { id, jobId, workerId, review: reviewParam } = useLocalSearchParams();
  const { profile, loading: authLoading, session } = useAuth();
  const { hireWorker, cancelHire, completeJob, getJobById, loadJob } = useJobs();
  const { markConversationRead, setOpenConversation } = useUnread();
  const insets = useSafeAreaInsets();
  const conversationIdParam = asConversationId(id);
  const [conversation, setConversation] = useState(() =>
    conversationIdParam ? readCachedConversation(conversationIdParam) : null
  );
  const [messages, setMessages] = useState(() =>
    conversationIdParam ? readCachedMessages(conversationIdParam) : []
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(!conversation);
  const [sending, setSending] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [acting, setActing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const listRef = useRef(null);

  const mapped = useMemo(
    () => (conversation ? mapConversation(conversation, profile?.id) : null),
    [conversation, profile?.id]
  );
  const peer = mapped ? otherParty(mapped, profile?.id) : null;
  const liveJob = mapped?.jobId ? getJobById(mapped.jobId) : null;
  const jobStatus = jobFlowStatus({
    status: liveJob?.status ?? mapped?.job?.status,
    isApproved: liveJob?.isApproved ?? mapped?.job?.isApproved ?? true,
    hiredWorkerId: liveJob?.hiredWorkerId ?? mapped?.job?.hiredWorkerId,
  });
  const hiredWorkerId = liveJob?.hiredWorkerId ?? mapped?.job?.hiredWorkerId;
  const isPoster = Boolean(mapped?.isPoster);
  const hired = Boolean(hiredWorkerId && hiredWorkerId === mapped?.workerId);
  const isAssigned = jobStatus === JOB_STATUS.ASSIGNED && hired;
  const isCompleted = jobStatus === JOB_STATUS.COMPLETED;
  const hiredSomeoneElse = Boolean(hiredWorkerId && hiredWorkerId !== mapped?.workerId);
  const canWorkerReply = posterHasMessaged(messages, mapped?.posterId);
  const canSend = isPoster || canWorkerReply;

  const load = useCallback(async () => {
    const conversationId = asConversationId(id);
    const jobKey = Array.isArray(jobId) ? jobId[0] : jobId;
    const workerKey = Array.isArray(workerId) ? workerId[0] : workerId;
    const cachedConversation = conversationId ? readCachedConversation(conversationId) : null;
    const cachedMessages = conversationId ? readCachedMessages(conversationId) : [];

    if (cachedConversation) setConversation(cachedConversation);
    if (cachedMessages.length) {
      setMessages((current) => mergeMessages(current, cachedMessages));
      setLoading(false);
    }

    let row = cachedConversation;
    if (conversationId) {
      try {
        row = (await fetchConversationById(conversationId)) || row;
      } catch {
        row = row || null;
      }
    }
    if (!row && jobKey && workerKey) {
      try {
        row = await fetchConversationByJobAndWorker(jobKey, workerKey);
      } catch {
        row = null;
      }
    }
    if (!row && jobKey && workerKey) {
      row = await getOrCreateConversation(jobKey, workerKey);
    }
    if (!row) {
      if (!cachedConversation) setConversation(null);
      setLoading(false);
      return;
    }
    setConversation(row);
    try {
      const items = await fetchMessages(row.id);
      setMessages(items);
    } catch {
      const fallback = mergeMessages(cachedMessages, readCachedMessages(row.id));
      setMessages(fallback);
    }
    await markConversationRead(row.id);
    setLoading(false);
  }, [id, jobId, markConversationRead, workerId]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return undefined;
      if (!session?.user) {
        setLoading(false);
        return undefined;
      }
      load().catch((err) => {
        Alert.alert('Không tải được chat', err.message ?? 'Vui lòng thử lại.');
        setLoading(false);
      });
      return undefined;
    }, [authLoading, load, session?.user])
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(Math.max(0, event.endCoordinates?.height ?? 0));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    if (!mapped?.id) return undefined;
    setOpenConversation(mapped.id);
    const unsubscribe = subscribeMessages(mapped.id, (message) => {
      setMessages((current) => {
        const next = current.some((item) => item.id === message.id)
          ? current
          : [...current, message];
        writeCachedMessages(mapped.id, next);
        return next;
      });
      if (message.senderId !== profile?.id) {
        markConversationRead(mapped.id);
      }
      if (message.kind === 'system' && mapped.jobId) {
        loadJob(mapped.jobId).catch(() => {});
      }
    });
    return () => {
      setOpenConversation(null);
      unsubscribe();
    };
  }, [loadJob, mapped?.id, mapped?.jobId, markConversationRead, profile?.id, setOpenConversation]);

  useEffect(() => {
    if (!isCompleted || !profile?.id || !mapped?.jobId) return undefined;
    let cancelled = false;
    fetchMyReviewForJob(mapped.jobId, profile.id)
      .then((row) => {
        if (cancelled) return;
        const already = Boolean(row);
        setReviewed(already);
        if (!already) {
          setRating(0);
          setRatingOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCompleted, mapped?.jobId, profile?.id, reviewParam]);

  async function send(kind = 'text', body = draft) {
    if (!mapped?.id || sending) return;
    if (kind === 'text' && !String(body || '').trim()) return;
    if (!canSend) {
      Alert.alert(
        'Chưa thể trả lời',
        'Người đăng tin phải gửi tin nhắn đầu tiên. Sau đó bạn mới trả lời được.'
      );
      return;
    }
    setSending(true);
    try {
      const created = await sendChatMessage(mapped.id, body, kind);
      setMessages((current) => {
        const next = mergeMessages(current, [created]);
        writeCachedMessages(mapped.id, next);
        return next;
      });
      if (kind === 'text') setDraft('');
    } catch (err) {
      Alert.alert('Không gửi được', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  async function callPeer() {
    const phone = peer?.phone;
    if (!phone) {
      Alert.alert('Chưa có số điện thoại', 'Đối phương chưa cập nhật số điện thoại trên hồ sơ.');
      return;
    }
    const parsed = parseVnPhone(phone);
    const url = `tel:${parsed?.e164 || phone}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Không gọi được', 'Thiết bị không mở được ứng dụng điện thoại.');
    }
  }

  function sharePhone() {
    if (!profile?.phone) {
      Alert.alert('Thiếu số điện thoại', 'Hãy cập nhật số điện thoại trong hồ sơ trước khi chia sẻ.');
      return;
    }
    send('phone_share', `Số điện thoại của tôi: ${displayPhone(profile.phone)}`);
  }

  function confirmHire() {
    if (!mapped?.bidId || !mapped?.jobId || hired || hiredSomeoneElse || isCompleted) return;
    Alert.alert(
      'Xác nhận thuê thợ',
      `Thuê ${peer?.fullName || 'thợ này'} với giá ${formatPrice(mapped.bid?.amount)}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thuê',
          onPress: async () => {
            try {
              await hireWorker(mapped.jobId, mapped.bidId);
              await load();
              Alert.alert('Đã thuê thợ', 'Thợ này chính thức thực hiện công việc.');
            } catch (err) {
              Alert.alert('Không thuê được', err.message ?? 'Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  }

  async function submitCancelHire(reason) {
    if (!mapped?.jobId || acting) return;
    setActing(true);
    try {
      await cancelHire(mapped.jobId, reason);
      setCancelOpen(false);
      router.replace({ pathname: '/job/[id]', params: { id: String(mapped.jobId) } });
    } catch (err) {
      Alert.alert('Không hủy thuê được', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setActing(false);
    }
  }

  function startPayment() {
    if (!isAssigned || acting) return;
    Alert.alert(
      'Thanh toán',
      `Xác nhận thanh toán ${formatPrice(mapped.bid?.amount)} cho ${peer?.fullName || 'thợ'}? Sau đó cả hai bên sẽ đánh giá nhau.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thanh toán',
          onPress: async () => {
            if (!mapped?.jobId || acting) return;
            setActing(true);
            try {
              await completeJob(mapped.jobId);
              await load();
              setRating(0);
              setRatingOpen(true);
            } catch (err) {
              Alert.alert('Không thanh toán được', err.message ?? 'Vui lòng thử lại.');
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
  }

  async function submitRating() {
    if (!mapped?.jobId || acting) return;
    if (rating < 1) {
      Alert.alert('Chọn số sao', 'Hãy chọn từ 1 đến 5 sao trước khi gửi đánh giá.');
      return;
    }
    setActing(true);
    try {
      await submitJobReview(mapped.jobId, { rating });
      setReviewed(true);
      setRatingOpen(false);
      Alert.alert('Đã gửi đánh giá', 'Cảm ơn bạn đã đánh giá.');
    } catch (err) {
      Alert.alert('Không gửi được đánh giá', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setActing(false);
    }
  }

  function renderMessage({ item }) {
    const mine = item.senderId === profile?.id;
    if (item.kind === 'system') {
      return (
        <View style={styles.systemWrap}>
          <Text style={styles.systemText}>{item.body}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {item.kind === 'phone_share' ? (
          <Text style={[styles.kindLabel, mine && styles.kindLabelMine]}>Đã chia sẻ số điện thoại</Text>
        ) : null}
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
        <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  }

  if (loading && !mapped) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!mapped) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.missing}>Không tìm thấy cuộc trò chuyện.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={keyboardInset > 0 ? [] : ['bottom']}>
      <Stack.Screen options={{ title: peer?.fullName || 'Chat / Gọi điện' }} />
      <KeyboardAvoidingView
        style={[styles.flex, { paddingBottom: keyboardInset }]}
        behavior={undefined}
        enabled={false}>
        <View style={styles.peerBar}>
          {peer?.avatarUrl ? (
            <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.initials}>{initialsFromName(peer?.fullName)}</Text>
            </View>
          )}
          <View style={styles.peerInfo}>
            <Text style={styles.peerName} numberOfLines={1}>
              {peer?.fullName}
            </Text>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {mapped.job?.title || 'Công việc'}
              {mapped.bid?.amount ? ` · ${formatPrice(mapped.bid.amount)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={callPeer}>
            <Ionicons name="call" size={16} color={Colors.primary} />
            <Text style={styles.actionText}>Gọi điện</Text>
          </Pressable>
          {isPoster ? (
            <Pressable style={styles.action} onPress={sharePhone} disabled={sending}>
              <Ionicons name="phone-portrait-outline" size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Gửi số điện thoại</Text>
            </Pressable>
          ) : null}
          {isPoster && !isAssigned && !isCompleted ? (
            <Pressable
              style={[
                styles.action,
                styles.hire,
                (hired || hiredSomeoneElse) && styles.hireDone,
              ]}
              onPress={confirmHire}
              disabled={hired || hiredSomeoneElse}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={hired || hiredSomeoneElse ? Colors.success : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.hireText,
                  (hired || hiredSomeoneElse) && styles.hireTextDone,
                ]}>
                {hiredSomeoneElse ? 'Đã thuê thợ khác' : hired ? 'Đã thuê' : 'Xác nhận thuê'}
              </Text>
            </Pressable>
          ) : null}
          {isPoster && isAssigned ? (
            <>
              <Pressable
                style={[styles.action, styles.cancelHire]}
                onPress={() => setCancelOpen(true)}
                disabled={acting}>
                <Ionicons name="close-circle" size={16} color="#B42318" />
                <Text style={styles.cancelHireText}>Hủy thuê</Text>
              </Pressable>
              <Pressable
                style={[styles.action, styles.pay]}
                onPress={startPayment}
                disabled={acting}>
                <Ionicons name="card" size={16} color="#FFFFFF" />
                <Text style={styles.hireText}>Thanh toán</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {isAssigned ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>
              {isPoster
                ? 'Đã nhận — thợ này đang thực hiện công việc. Bạn có thể hủy thuê để chọn người khác, hoặc thanh toán để hoàn thành.'
                : 'Bạn đã được thuê cho công việc này.'}
            </Text>
          </View>
        ) : null}

        {isCompleted ? (
          <View style={[styles.statusBanner, styles.completedBanner]}>
            <Text style={[styles.statusBannerText, styles.completedBannerText]}>
              Công việc đã hoàn thành.
            </Text>
          </View>
        ) : null}

        {!isPoster && !canWorkerReply ? (
          <View style={styles.waitBanner}>
            <Text style={styles.waitText}>
              Người đăng tin phải gửi tin nhắn đầu tiên. Sau đó bạn mới trả lời được.
            </Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderMessage}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.empty}>Hãy bắt đầu cuộc trò chuyện.</Text>}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={canSend ? 'Nhắn tin...' : 'Chờ người đăng tin nhắn trước'}
            placeholderTextColor={Colors.textLight}
            value={draft}
            onChangeText={setDraft}
            editable={canSend}
            multiline
          />
          <Pressable
            style={[styles.send, (!canSend || sending) && styles.sendDisabled]}
            onPress={() => send('text')}
            disabled={!canSend || sending}>
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={16} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={cancelOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !acting && setCancelOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Lý do hủy thuê</Text>
            <Text style={styles.sheetHint}>
              Sau khi hủy, việc sẽ mở lại để bạn chọn thợ khác từ danh sách đề xuất.
            </Text>
            {HIRE_CANCEL_REASONS.map((item) => (
              <Pressable
                key={item.id}
                style={styles.reasonRow}
                disabled={acting}
                onPress={() => submitCancelHire(item.label)}>
                <Text style={styles.reasonText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
              </Pressable>
            ))}
            {acting ? <ActivityIndicator style={styles.sheetLoader} color={Colors.primary} /> : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={ratingOpen && !reviewed} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => {}}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{isPoster ? 'Đánh giá thợ' : 'Đánh giá chủ việc'}</Text>
            <Text style={styles.sheetHint}>
              Công việc đã thanh toán. Chọn số sao cho {peer?.fullName || (isPoster ? 'thợ' : 'chủ việc')}.
            </Text>
            <View style={styles.ratingWrap}>
              <StarRow rating={rating} size={32} onChange={setRating} />
            </View>
            <Pressable
              style={[styles.cta, acting && styles.sendDisabled]}
              onPress={submitRating}
              disabled={acting}>
              {acting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>Gửi đánh giá</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.skip}
              disabled={acting}
              onPress={() => setRatingOpen(false)}>
              <Text style={styles.skipText}>Để sau</Text>
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
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: 40,
  },
  missing: {
    padding: 24,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  peerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.primary,
    fontWeight: '800',
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    fontWeight: '800',
    color: Colors.text,
    fontSize: 15,
  },
  jobTitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.surface,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  hire: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  hireDone: {
    backgroundColor: Colors.successSoft,
    borderColor: Colors.success,
  },
  hireText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  hireTextDone: {
    color: Colors.success,
  },
  cancelHire: {
    borderColor: '#FDA29B',
    backgroundColor: '#FEF3F2',
  },
  cancelHireText: {
    color: '#B42318',
    fontWeight: '800',
    fontSize: 13,
  },
  pay: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: Colors.assignedSoft,
    borderRadius: Radius.md,
    padding: 12,
  },
  statusBannerText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  completedBanner: {
    backgroundColor: Colors.successSoft,
  },
  completedBannerText: {
    color: Colors.success,
    fontWeight: '700',
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
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetHint: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  sheetLoader: {
    marginTop: 8,
  },
  ratingWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    color: Colors.textMuted,
    fontWeight: '700',
  },
  waitBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#FFFAEB',
    borderRadius: Radius.md,
    padding: 12,
  },
  waitText: {
    color: '#93370D',
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: 24,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
  },
  bubbleText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  kindLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  kindLabelMine: {
    color: '#D6E4FF',
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.textLight,
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: '#D6E4FF',
  },
  systemWrap: {
    alignSelf: 'center',
    backgroundColor: Colors.assignedSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  systemText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
});
