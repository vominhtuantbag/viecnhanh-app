import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import StarRow from '@/components/StarRow';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { formatPrice } from '@/data/jobs';
import { initialsFromName } from '@/services/profiles';

export default function BidCard({ quote, onPress, hired, showNew }) {
  const worker = quote.worker || {};
  const name = worker.fullName || 'Thợ Việc Nhanh';
  const reviews = worker.reviewsCount ?? 0;
  const completed = worker.completedJobs ?? 0;
  const rating = Number(worker.ratingAvg) || 0;
  const accepted = (quote.status === 'accepted' || hired) && quote.status !== 'cancelled';
  const cancelled = quote.status === 'cancelled';

  const content = (
    <>
      <View style={styles.header}>
        {worker.avatarUrl ? (
          <Image source={{ uri: worker.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>{initialsFromName(name)}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {showNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newText}>Mới</Text>
              </View>
            ) : null}
            {accepted ? (
              <View style={styles.hiredBadge}>
                <Text style={styles.hiredText}>Đã thuê</Text>
              </View>
            ) : null}
            {cancelled ? (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledText}>Đã hủy thuê</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            <StarRow rating={rating} />
            <Text style={styles.ratingValue}>{reviews > 0 ? rating.toFixed(1) : '—'}</Text>
          </View>
          <Text style={styles.completed}>
            {reviews} lượt đánh giá · {completed} việc đã hoàn thành
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.price}>{formatPrice(quote.amount)}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textLight} /> : null}
        </View>
      </View>
      {quote.note ? <Text style={styles.note}>{quote.note}</Text> : null}
      {cancelled && quote.cancelReason ? (
        <Text style={styles.cancelReason}>Lý do hủy: {quote.cancelReason}</Text>
      ) : null}
      {onPress ? (
        <Text style={styles.hint}>Nhấn để chat, gọi điện hoặc xác nhận thuê</Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.card} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
    ...Shadow.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontWeight: '800',
    color: Colors.text,
    fontSize: 15,
  },
  newBadge: {
    backgroundColor: '#FEE4E2',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newText: {
    color: '#D92D20',
    fontSize: 10,
    fontWeight: '800',
  },
  hiredBadge: {
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hiredText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  cancelledBadge: {
    backgroundColor: '#FEE4E2',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cancelledText: {
    color: '#D92D20',
    fontSize: 10,
    fontWeight: '800',
  },
  ratingRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  completed: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textMuted,
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
  },
  price: {
    fontWeight: '800',
    color: Colors.primary,
    fontSize: 15,
  },
  note: {
    marginTop: 10,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  cancelReason: {
    marginTop: 8,
    color: '#B42318',
    fontSize: 12,
    lineHeight: 18,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
});
