import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import BannerCarousel from '@/components/BannerCarousel';
import NotificationBell from '@/components/NotificationBell';
import RecentJobsCarousel from '@/components/RecentJobsCarousel';
import TipsTicker from '@/components/TipsTicker';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useJobs } from '@/context/JobsContext';
import { replaceCatalogMains, useCatalog, visibleMains } from '@/data/catalog';
import { isJobLive, statusLabel } from '@/data/jobs';
import { getProvinceById } from '@/data/locations';
import { subscribePostgresChanges } from '@/lib/realtime';
import { FALLBACK_BANNERS, FALLBACK_TIPS, fetchActiveMainCategories, fetchHomeBanners, fetchHomeTips } from '@/services/homeContent';

const SAMPLE_SLIDES = [
  {
    id: 'sample-garden',
    title: 'Làm vườn',
    price: 350000,
    place: 'Đà Nẵng',
    stamp: '21:20 12-10',
    views: 0,
    status: 'approved',
    statusText: 'Đang mở',
    sample: true,
  },
  {
    id: 'sample-clean',
    title: 'Dọn dẹp nhà cuối tuần',
    price: 400000,
    place: 'Hà Nội',
    stamp: '09:15 14-10',
    views: 3,
    status: 'approved',
    statusText: 'Đang mở',
    sample: true,
  },
  {
    id: 'sample-electric',
    title: 'Sửa điện nước',
    price: 500000,
    place: 'TP. Hồ Chí Minh',
    stamp: '18:40 13-10',
    views: 8,
    status: 'approved',
    statusText: 'Đang mở',
    sample: true,
  },
];

function greetingNow(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'Buổi sáng vui vẻ!';
  if (hour >= 11 && hour < 14) return 'Buổi trưa năng động!';
  if (hour >= 14 && hour < 18) return 'Buổi chiều ấm áp!';
  return 'Buổi tối an lành!';
}

function formatStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Linh hoạt';
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}-${pad(date.getMonth() + 1)}`;
}

function toSlide(job) {
  return {
    id: job.id,
    title: job.title,
    price: job.price,
    place: getProvinceById(job.provinceId)?.name || 'Chưa rõ nơi',
    stamp: formatStamp(job.createdAt),
    views: job.views,
    status: job.status,
    statusText: statusLabel(job.status),
    sample: false,
  };
}

function openBanner(item) {
  const value = String(item?.link || '').trim();
  if (!value) return;
  if (/^https?:\/\//i.test(value)) {
    Linking.openURL(value).catch(() => {});
    return;
  }
  const path = value.startsWith('/') ? value : `/${value}`;
  if (path === '/browse' || path === '/home') {
    router.push('/(tabs)/browse');
    return;
  }
  if (path === '/rewards' || path === '/promotions' || path === '/quests') {
    router.push('/settings/quests');
    return;
  }
  if (path === '/create' || path === '/post') {
    router.push('/create');
    return;
  }
  const job = path.match(/^\/jobs\/([^/]+)/);
  if (job) {
    router.push(`/job/${job[1]}`);
    return;
  }
  router.push(path);
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { jobs, refreshJobs } = useJobs();
  const catalog = useCatalog();
  const [banners, setBanners] = useState(FALLBACK_BANNERS);
  const [tips, setTips] = useState(FALLBACK_TIPS);
  const [remoteCategories, setRemoteCategories] = useState(null);
  const [greeting, setGreeting] = useState(greetingNow);
  const [refreshing, setRefreshing] = useState(false);
  const name = String(profile?.full_name || '').trim() || 'bạn';
  const categories = remoteCategories || visibleMains(catalog);

  const recentJobs = useMemo(() => {
    return jobs
      .filter((job) => isJobLive(job))
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 3)
      .map(toSlide);
  }, [jobs]);
  const slides = recentJobs.length ? recentJobs : SAMPLE_SLIDES;

  const loadHome = useCallback(async () => {
    const [nextBanners, nextCategories, nextTips] = await Promise.all([
      fetchHomeBanners(),
      fetchActiveMainCategories(),
      fetchHomeTips(),
    ]);
    if (nextBanners?.length) setBanners(nextBanners);
    if (nextCategories?.length) {
      setRemoteCategories(nextCategories);
      replaceCatalogMains(nextCategories);
    }
    if (nextTips) setTips(nextTips);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadHome().catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [loadHome]);

  useEffect(() => {
    const clock = setInterval(() => setGreeting(greetingNow()), 30000);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') setGreeting(greetingNow());
    });
    return () => {
      clearInterval(clock);
      app.remove();
    };
  }, []);

  useEffect(() => {
    return subscribePostgresChanges('home-tips', [
      {
        event: '*',
        table: 'notification_templates',
        callback: () => {
          fetchHomeTips()
            .then((next) => {
              if (next) setTips(next);
            })
            .catch(() => {});
        },
      },
    ]);
  }, []);

  function goToCreate(extra = {}) {
    router.push({
      pathname: '/create',
      params: {
        title: extra.title ?? '',
        categoryId: extra.categoryId ?? '',
      },
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refreshJobs(), loadHome()]);
    } catch {
      // Giữ nội dung đang có nếu lần tải này lỗi.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.logo}>Việc Nhanh</Text>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}>
        <View style={styles.hero}>
          <Text style={styles.greeting}>{greeting}</Text>
          <BannerCarousel banners={banners} onOpen={openBanner} tone="blue" />
        </View>

        <TipsTicker tips={tips} />

        <Pressable style={styles.callout} onPress={() => goToCreate()}>
          <View style={styles.calloutIcon}>
            <Ionicons name="flash" size={22} color={Colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.calloutTitle}>Cần gấp? Đăng việc ngay</Text>
            <Text style={styles.calloutText}>Nhận đề xuất trong vài phút từ người làm việc gần bạn.</Text>
          </View>
        </Pressable>

        <View style={styles.grid}>
          {categories.map((item) => (
            <View key={item.id} style={styles.cell}>
              <Pressable
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                onPress={() => goToCreate({ categoryId: item.id })}>
                <View style={styles.iconWrap}>
                  {item.iconUrl ? (
                    <Image source={{ uri: item.iconUrl }} style={styles.catIcon} contentFit="contain" />
                  ) : (
                    <Ionicons name={item.icon || 'pricetag-outline'} size={26} color={Colors.primary} />
                  )}
                </View>
                <Text style={styles.tileName} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={styles.jobsTitle}>Có việc mới kìa, {name} ơi!</Text>
        {recentJobs.length === 0 ? (
          <Text style={styles.sampleHint}>Chưa có tin đang mở. Vuốt để xem ví dụ.</Text>
        ) : null}
        <RecentJobsCarousel
          key={recentJobs.length ? 'live' : 'sample'}
          jobs={slides}
          onPress={(job) => {
            if (job.sample) {
              router.push('/(tabs)/browse');
              return;
            }
            router.push(`/job/${job.id}`);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  content: {
    paddingBottom: 28,
    backgroundColor: Colors.background,
  },
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  callout: {
    marginTop: 14,
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
  },
  calloutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  calloutText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  cell: {
    width: '33.333%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  tile: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    minHeight: 118,
    ...Shadow.soft,
  },
  tilePressed: {
    backgroundColor: '#F8FAFF',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  catIcon: {
    width: 28,
    height: 28,
  },
  tileName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
  },
  jobsTitle: {
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: 16,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  sampleHint: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: -4,
    color: Colors.textMuted,
    fontSize: 13,
  },
});
