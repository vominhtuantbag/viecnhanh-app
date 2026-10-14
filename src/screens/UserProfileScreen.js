import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import StarRow from '@/components/StarRow';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useCatalog } from '@/data/catalog';
import { displayPhone, isPhoneAliasEmail } from '@/lib/phone';
import { chosenSkills, fetchPublicProfile, initialsFromName } from '@/services/profiles';

function formatWhen(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function roleLabel(role) {
  return role === 'poster' ? 'Với vai trò chủ việc' : 'Với vai trò thợ';
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id;
  const catalog = useCatalog();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const skills = chosenSkills(user?.skillIds);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchPublicProfile(userId);
        if (!cancelled) setUser(row);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, catalog]);

  const phone = user?.phone ? displayPhone(user.phone) : '';
  const email = user?.email && !isPhoneAliasEmail(user.email) ? user.email : '';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: user?.fullName || 'Hồ sơ người dùng' }} />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      ) : !user ? (
        <Text style={styles.missing}>Không tìm thấy người dùng.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.initials}>{initialsFromName(user.fullName)}</Text>
              </View>
            )}
            <Text style={styles.name}>{user.fullName}</Text>
            <Text style={styles.badge}>{user.idVerified ? 'Đã xác minh CCCD' : 'Chưa xác minh'}</Text>
            {phone ? <Text style={styles.meta}>{phone}</Text> : null}
            {email ? <Text style={styles.meta}>{email}</Text> : null}
            {user.createdAt ? <Text style={styles.meta}>Tham gia {formatWhen(user.createdAt)}</Text> : null}

            <View style={styles.stats}>
              <Stat value={user.reviewsCount ? Number(user.ratingAvg).toFixed(1) : '—'} label="Điểm" />
              <Stat value={String(user.reviewsCount || 0)} label="Đánh giá" />
              <Stat value={String(user.completedJobs || 0)} label="Việc xong" />
            </View>
            <View style={styles.stars}>
              <StarRow rating={user.ratingAvg} />
            </View>
          </View>

          <Text style={styles.section}>Kỹ năng</Text>
          {skills.length === 0 ? (
            <Text style={styles.empty}>Chưa chọn kỹ năng.</Text>
          ) : (
            <View style={styles.chips}>
              {skills.map((item) => (
                <View key={item.id} style={styles.chip}>
                  <Text style={styles.chipText}>{item.name}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.section}>Đánh giá ({user.reviews?.length || 0})</Text>
          {(user.reviews || []).length === 0 ? (
            <Text style={styles.empty}>Chưa có đánh giá.</Text>
          ) : (
            user.reviews.map((review) => (
              <View key={review.id} style={styles.review}>
                <View style={styles.reviewTop}>
                  <StarRow rating={review.rating} />
                  <Text style={styles.reviewDate}>{formatWhen(review.createdAt)}</Text>
                </View>
                <Text style={styles.reviewRole}>{roleLabel(review.role)}</Text>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { marginTop: 40 },
  missing: { padding: 24, textAlign: 'center', color: Colors.textMuted },
  content: { padding: 20, paddingBottom: 32 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: 'center',
    ...Shadow.card,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySoft,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontWeight: '800', fontSize: 28 },
  name: { marginTop: 12, fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  badge: { marginTop: 6, color: Colors.primary, fontWeight: '700', fontSize: 13 },
  meta: { marginTop: 4, color: Colors.textMuted, fontSize: 13 },
  stats: { marginTop: 16, flexDirection: 'row', alignSelf: 'stretch', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { marginTop: 2, fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  stars: { marginTop: 12 },
  section: { marginTop: 22, marginBottom: 10, fontSize: 16, fontWeight: '800', color: Colors.text },
  empty: { color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  review: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  reviewDate: { fontSize: 12, color: Colors.textLight },
  reviewRole: { marginTop: 6, fontSize: 12, fontWeight: '700', color: Colors.primary },
  reviewComment: { marginTop: 6, color: Colors.textMuted, lineHeight: 20 },
});
