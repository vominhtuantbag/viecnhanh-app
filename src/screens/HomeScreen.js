import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AreaPicker } from '@/components/AreaPicker';
import { JobCard } from '@/components/JobCard';
import { useJobs } from '@/context/JobsContext';
import { isJobLive } from '@/data/jobs';
import { sameProvince } from '@/data/locations';

export default function HomeScreen() {
  const { jobs, loading, error, refreshJobs } = useJobs();
  const [provinceId, setProvinceId] = useState('');
  const [wardId, setWardId] = useState('');

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!isJobLive(job)) return false;
      if (provinceId && !sameProvince(job.provinceId, provinceId)) return false;
      if (wardId && job.wardId !== wardId) return false;
      return true;
    });
  }, [jobs, provinceId, wardId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.appName}>Việc Nhanh</Text>
        <Text style={styles.subtitle}>Tin đăng gần bạn</Text>
      </View>

      <View style={styles.filter}>
        <AreaPicker
          provinceId={provinceId}
          wardId={wardId}
          onChange={({ provinceId: nextProvince, wardId: nextWard }) => {
            setProvinceId(nextProvince);
            setWardId(nextWard);
          }}
        />
      </View>

      {loading && jobs.length === 0 ? (
        <ActivityIndicator style={styles.loader} color="#0F7B4B" />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshJobs} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>Không có tin nào trong khu vực này.</Text>
          )
        }
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#64748B',
  },
  filter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748B',
  },
  loader: {
    marginTop: 16,
  },
  error: {
    paddingHorizontal: 16,
    color: '#B42318',
  },
});
