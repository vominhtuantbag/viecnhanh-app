import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/jobs';
import { fetchDashboardStats } from '@/services/account';

export default function DashboardScreen() {
  const { session, profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const profileId = profile?.id;
  const load = useCallback(async () => {
    if (!profileId) {
      setStats(null);
      setLoading(false);
      return;
    }
    const next = await fetchDashboardStats(profileId);
    setStats(next);
    setLoading(false);
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => setLoading(false));
    }, [load])
  );

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text style={styles.hello}>Xin chào, {profile?.full_name || 'bạn'}</Text>
        <Text style={styles.sub}>Tổng quan thu nhập và công việc trên Việc Nhanh.</Text>

        {loading && !stats ? <ActivityIndicator color={Colors.primary} /> : null}

        <View style={styles.grid}>
          <Stat label="Thu nhập (việc đã nhận)" value={formatPrice(stats?.income ?? 0)} wide />
          <Stat label="Việc đã làm" value={String(stats?.completedJobs ?? 0)} />
          <Stat label="Việc đã đăng" value={String(stats?.postedCount ?? 0)} />
          <Stat label="Tin đang mở" value={String(stats?.openPostedCount ?? 0)} />
          <Stat label="Tin đã thuê thợ" value={String(stats?.hiredPostedCount ?? 0)} />
          <Stat label="Đề xuất đã gửi" value={String(stats?.bidCount ?? 0)} />
          <Stat label="Ngân sách các tin đăng" value={formatPrice(stats?.postedBudget ?? 0)} wide />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, wide }) {
  return (
    <View style={[styles.stat, wide && styles.wide]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  hello: { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub: { marginTop: 6, marginBottom: 18, color: Colors.textMuted, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadow.soft,
  },
  wide: { width: '100%' },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  value: { marginTop: 8, fontSize: 20, fontWeight: '800', color: Colors.text },
});
