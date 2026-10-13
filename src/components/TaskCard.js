import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { CountBadge } from '@/components/CountBadge';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useUnread } from '@/context/UnreadContext';
import { JOB_STATUS, formatPrice, jobFlowStatus, statusLabel, viewLabel } from '@/data/jobs';
import { formatArea } from '@/data/locations';

const BADGE = {
  [JOB_STATUS.PENDING]: { wrap: 'badgePending', color: Colors.warning },
  [JOB_STATUS.APPROVED]: { wrap: 'badgeOpen', color: Colors.primary },
  [JOB_STATUS.ASSIGNED]: { wrap: 'badgeAssigned', color: Colors.assigned },
  [JOB_STATUS.COMPLETED]: { wrap: 'badgeCompleted', color: Colors.success },
  [JOB_STATUS.CLOSED]: { wrap: 'badgeCancelled', color: '#D92D20' },
};

export function TaskCard({ job, badgeLabel, badgeStatus }) {
  const { bidUnreadByJob } = useUnread();
  const unreadBids = bidUnreadByJob[job.id] || 0;
  const flow = badgeStatus || jobFlowStatus(job);
  const badge = BADGE[flow] || BADGE[JOB_STATUS.ASSIGNED];
  const label = badgeLabel || statusLabel(jobFlowStatus(job));

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/job/${job.id}`)}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={styles.price}>{formatPrice(job.price)}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="location-outline" size={15} color={Colors.textMuted} />
        <Text style={styles.meta} numberOfLines={1}>
          {formatArea(job.provinceId, job.wardId)}
        </Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={15} color={Colors.textMuted} />
        <Text style={styles.meta}>{job.dateLabel}</Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.badge, styles[badge.wrap]]}>
          <View style={[styles.dot, { backgroundColor: badge.color }]} />
          <Text style={[styles.badgeText, { color: badge.color }]}>{label}</Text>
        </View>
        <View style={styles.views}>
          {unreadBids > 0 ? <CountBadge count={unreadBids} /> : null}
          <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.offers}>{viewLabel(job.views)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 8,
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 22,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
  },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  badgeOpen: {
    backgroundColor: Colors.primarySoft,
  },
  badgePending: {
    backgroundColor: '#FEF0C7',
  },
  badgeAssigned: {
    backgroundColor: Colors.assignedSoft,
  },
  badgeCompleted: {
    backgroundColor: Colors.successSoft,
  },
  badgeCancelled: {
    backgroundColor: '#FEE4E2',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  views: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offers: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
