import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import StarRow from '@/components/StarRow';
import UserIdentityCard from '@/components/UserIdentityCard';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { fetchPublicProfile } from '@/services/profiles';

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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, [userId]);

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
            <UserIdentityCard user={user} />
            <Text style={styles.completed}>{user.completedJobs} việc đã hoàn thành</Text>
          </View>

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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loader: {
    marginTop: 40,
  },
  missing: {
    padding: 24,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  completed: {
    marginTop: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  section: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  empty: {
    color: Colors.textMuted,
  },
  review: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  reviewRole: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  reviewComment: {
    marginTop: 6,
    color: Colors.textMuted,
    lineHeight: 20,
  },
});
