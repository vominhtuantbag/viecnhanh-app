import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { formatDistance, formatPrice, statusLabel, viewLabel } from '@/data/jobs';

export function JobCard({ job, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={styles.price}>{formatPrice(job.price)}</Text>
      </View>

      <Text style={styles.status}>{statusLabel(job.status)}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.meta}>{viewLabel(job.views)}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{formatDistance(job.distanceKm)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    ...Shadow.soft,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  status: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.successSoft,
    color: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  dot: {
    color: Colors.textLight,
  },
});
