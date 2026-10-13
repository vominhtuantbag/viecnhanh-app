import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import StarRow from '@/components/StarRow';
import { Colors } from '@/constants/colors';
import { initialsFromName } from '@/services/profiles';

export default function UserIdentityCard({ user, onPress, compact = false }) {
  const name = user?.fullName || 'Người dùng Việc Nhanh';
  const rating = Number(user?.ratingAvg) || 0;
  const reviews = Number(user?.reviewsCount) || 0;
  const verified = Boolean(user?.idVerified);

  const content = (
    <>
      {user?.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.initials}>{initialsFromName(name)}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {verified ? (
            <View style={styles.verified}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={styles.verifiedText}>Đã xác minh CCCD</Text>
            </View>
          ) : (
            <View style={styles.unverified}>
              <Ionicons name="shield-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.unverifiedText}>Chưa xác minh</Text>
            </View>
          )}
        </View>
        <View style={styles.ratingRow}>
          <StarRow rating={rating} size={compact ? 13 : 15} />
          <Text style={styles.ratingValue}>{reviews > 0 ? rating.toFixed(1) : '—'}</Text>
          <Text style={styles.ratingMeta}>
            {reviews} đánh giá · chủ việc & thợ
          </Text>
        </View>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={Colors.textLight} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontWeight: '800',
    color: Colors.text,
    fontSize: 16,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  unverified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unverifiedText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  ratingRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  ratingMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
