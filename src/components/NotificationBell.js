import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { openFromPushData } from '@/lib/push';
import { subscribePostgresChanges } from '@/lib/realtime';
import {
  SAMPLE_NOTIFICATIONS,
  fetchMyNotifications,
  mapNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/inbox';
import { badgeLabel } from '@/services/unread';

function dayLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Trước đó';
  const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(date)) / 86400000);
  if (diff <= 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN');
}

function clockLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function NotificationBell() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const userId = session?.user?.id || profile?.id || null;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [usingSamples, setUsingSamples] = useState(true);

  const load = useCallback(async () => {
    if (!userId || String(userId).startsWith('local-')) {
      setItems(SAMPLE_NOTIFICATIONS);
      setUsingSamples(true);
      return;
    }
    const rows = await fetchMyNotifications(userId);
    if (!rows || rows.length === 0) {
      setItems(SAMPLE_NOTIFICATIONS);
      setUsingSamples(true);
      return;
    }
    setItems(rows);
    setUsingSamples(false);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => {
        setItems(SAMPLE_NOTIFICATIONS);
        setUsingSamples(true);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!userId || String(userId).startsWith('local-')) return undefined;
    return subscribePostgresChanges(`inbox-${userId}`, [
      {
        event: '*',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
        callback: (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (!id) return;
            setItems((current) => current.filter((item) => item.id !== id));
            return;
          }
          const next = payload.new ? mapNotification(payload.new) : null;
          if (!next) return;
          setUsingSamples(false);
          setItems((current) => {
            const real = current.filter((item) => !item.sample);
            const exists = real.some((item) => item.id === next.id);
            if (payload.eventType === 'INSERT' && !exists) return [next, ...real];
            if (exists) return real.map((item) => (item.id === next.id ? next : item));
            return [next, ...real];
          });
        },
      },
    ]);
  }, [userId]);

  const unread = useMemo(
    () => items.filter((item) => !item.sample && !item.readAt).length,
    [items]
  );
  const badge = badgeLabel(unread);

  const groups = useMemo(() => {
    const buckets = [];
    for (const item of items) {
      const label = item.sample ? 'Thông báo mẫu' : dayLabel(item.createdAt);
      const last = buckets[buckets.length - 1];
      if (!last || last.label !== label) buckets.push({ label, rows: [item] });
      else last.rows.push(item);
    }
    return buckets;
  }, [items]);

  async function openItem(item) {
    const stamp = new Date().toISOString();
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, readAt: row.readAt || stamp } : row))
    );
    setOpen(false);
    if (!item.sample) {
      markNotificationRead(item.id).catch(() => {});
      openFromPushData(item.data);
    }
  }

  async function readAll() {
    const stamp = new Date().toISOString();
    setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt || stamp })));
    if (!usingSamples && userId) {
      markAllNotificationsRead(userId).catch(() => {});
    }
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Thông báo"
        hitSlop={8}
        style={styles.button}
        onPress={() => {
          setOpen(true);
          load().catch(() => {});
        }}>
        <Ionicons name="notifications-outline" size={26} color={Colors.primary} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.head}>
              <Text style={styles.headTitle}>Thông báo</Text>
              <View style={styles.headActions}>
                {unread > 0 ? (
                  <Pressable onPress={readAll} hitSlop={8}>
                    <Text style={styles.readAll}>Đã đọc hết</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={Colors.text} />
                </Pressable>
              </View>
            </View>
            {usingSamples ? (
              <Text style={styles.sampleNote}>Chưa có thông báo thật. Dưới đây là vài mẫu để xem thử.</Text>
            ) : null}
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <View key={group.label}>
                  <Text style={styles.group}>{group.label}</Text>
                  {group.rows.map((item) => {
                    const unreadRow = !item.readAt;
                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        onPress={() => openItem(item)}>
                        <View style={[styles.icon, unreadRow && styles.iconUnread]}>
                          <Ionicons
                            name={unreadRow ? 'notifications' : 'notifications-outline'}
                            size={18}
                            color={unreadRow ? Colors.primary : Colors.textMuted}
                          />
                        </View>
                        <View style={styles.copy}>
                          <Text style={[styles.rowTitle, unreadRow && styles.rowTitleUnread]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {item.body ? (
                            <Text style={styles.rowBody} numberOfLines={2}>
                              {item.body}
                            </Text>
                          ) : null}
                          <Text style={styles.time}>{clockLabel(item.createdAt)}</Text>
                        </View>
                        {unreadRow ? <View style={styles.unreadDot} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
          <Pressable style={styles.dismiss} onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#D92D20',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    maxHeight: '78%',
    paddingBottom: 8,
  },
  dismiss: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  headActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  readAll: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  sampleNote: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  group: {
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  rowPressed: {
    backgroundColor: Colors.primarySoft,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: {
    backgroundColor: Colors.primarySoft,
  },
  copy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  rowTitleUnread: {
    fontWeight: '800',
  },
  rowBody: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  time: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D92D20',
    marginTop: 6,
  },
});
