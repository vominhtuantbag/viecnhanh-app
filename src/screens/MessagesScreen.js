import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountBadge } from '@/components/CountBadge';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useUnread } from '@/context/UnreadContext';
import {
  fetchConversationsForUser,
  groupConversationsByPeer,
  mapConversation,
  otherParty,
} from '@/services/chat';
import { initialsFromName } from '@/services/profiles';

function previewOf(message) {
  if (!message) return 'Chưa có tin nhắn';
  if (message.kind === 'phone_share') return 'Đã chia sẻ số điện thoại';
  if (message.kind === 'system') return message.body;
  return message.body;
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function MessagesScreen() {
  const { session, profile } = useAuth();
  const { messageUnreadByConv } = useUnread();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedGroup, setPickedGroup] = useState(null);
  const userId = profile?.id;

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchConversationsForUser(userId);
      setItems(rows.map((row) => mapConversation(row, userId)));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => setLoading(false));
    }, [load])
  );

  const groups = useMemo(
    () => groupConversationsByPeer(items, userId),
    [items, userId]
  );

  function openConversation(conversation) {
    setPickedGroup(null);
    router.push(`/chat/${conversation.id}`);
  }

  function openGroup(group) {
    if (group.conversations.length === 1) {
      openConversation(group.latest);
      return;
    }
    setPickedGroup(group);
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.title}>Tin nhắn</Text>
        <View style={styles.guest}>
          <Text style={styles.guestTitle}>Đăng nhập để xem hội thoại</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Tin nhắn</Text>
      {loading && items.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      ) : null}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>
              Chưa có cuộc trò chuyện. Chủ việc mở đề xuất của thợ để bắt đầu chat; thợ sẽ thấy hội thoại ở đây sau tin nhắn đầu.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const conversation = item.latest;
          const peer = otherParty(conversation, profile?.id);
          const unread = item.conversations.reduce(
            (sum, row) => sum + (messageUnreadByConv[row.id] || 0),
            0
          );
          const jobLine =
            item.conversations.length > 1
              ? `${item.conversations.length} công việc`
              : conversation.job?.title || 'Công việc';
          return (
            <Pressable style={styles.row} onPress={() => openGroup(item)}>
              {peer?.avatarUrl ? (
                <Image source={{ uri: peer.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initialsFromName(peer?.fullName)}</Text>
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.top}>
                  <Text style={styles.name} numberOfLines={1}>
                    {peer?.fullName}
                  </Text>
                  <Text style={styles.time}>
                    {formatWhen(conversation.lastMessage?.createdAt || conversation.createdAt)}
                  </Text>
                </View>
                <Text style={styles.job} numberOfLines={1}>
                  {jobLine}
                </Text>
                <Text
                  style={[styles.preview, unread ? styles.previewUnread : null]}
                  numberOfLines={1}>
                  {previewOf(conversation.lastMessage)}
                </Text>
              </View>
              <CountBadge count={unread} />
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </Pressable>
          );
        }}
      />
      <Modal visible={Boolean(pickedGroup)} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setPickedGroup(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Chọn công việc</Text>
            <Text style={styles.sheetMeta}>
              Các tin nhắn với cùng một người được gộp lại. Chọn việc để mở hội thoại.
            </Text>
            {(pickedGroup?.conversations || [])
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.lastMessage?.createdAt || b.createdAt || 0).getTime() -
                  new Date(a.lastMessage?.createdAt || a.createdAt || 0).getTime()
              )
              .map((conversation) => (
                <Pressable
                  key={conversation.id}
                  style={styles.sheetRow}
                  onPress={() => openConversation(conversation)}>
                  <View style={styles.sheetBody}>
                    <Text style={styles.sheetJob} numberOfLines={1}>
                      {conversation.job?.title || 'Công việc'}
                    </Text>
                    <Text style={styles.sheetPreview} numberOfLines={1}>
                      {previewOf(conversation.lastMessage)}
                    </Text>
                  </View>
                  <CountBadge count={messageUnreadByConv[conversation.id]} />
                </Pressable>
              ))}
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
  title: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  loader: {
    marginTop: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gap: {
    height: 10,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: 32,
    lineHeight: 20,
  },
  guest: {
    margin: 20,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadow.card,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  primary: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadow.soft,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primarySoft,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 8,
  },
  name: {
    flex: 1,
    fontWeight: '700',
    color: Colors.text,
    fontSize: 15,
  },
  time: {
    fontSize: 12,
    color: Colors.textLight,
  },
  job: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  preview: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  previewUnread: {
    color: Colors.text,
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
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetMeta: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  sheetBody: {
    flex: 1,
    minWidth: 0,
  },
  sheetJob: {
    fontWeight: '700',
    color: Colors.text,
    fontSize: 15,
  },
  sheetPreview: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
