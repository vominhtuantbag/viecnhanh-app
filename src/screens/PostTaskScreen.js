import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import BannerCarousel from '@/components/BannerCarousel';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { replaceCatalogMains, useCatalog, visibleMains } from '@/data/catalog';
import { fetchActiveMainCategories, fetchHomeBanners, FALLBACK_BANNERS } from '@/services/homeContent';

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

export default function PostTaskScreen() {
  const { profile } = useAuth();
  const catalog = useCatalog();
  const [banners, setBanners] = useState(FALLBACK_BANNERS);
  const [remoteCategories, setRemoteCategories] = useState(null);
  const name = String(profile?.full_name || '').trim();
  const categories = remoteCategories || visibleMains(catalog);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([fetchHomeBanners(), fetchActiveMainCategories()])
        .then(([nextBanners, nextCategories]) => {
          if (cancelled) return;
          if (nextBanners?.length) setBanners(nextBanners);
          if (nextCategories?.length) {
            setRemoteCategories(nextCategories);
            replaceCatalogMains(nextCategories);
          }
        })
        .catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Việc Nhanh</Text>
          <Pressable style={styles.helpBtn}>
            <Ionicons name="help-circle-outline" size={22} color={Colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.hero} numberOfLines={2}>
          {name ? `Chào, ${name}!` : 'Chào!'}
        </Text>

        <BannerCarousel banners={banners} onOpen={openBanner} />

        <Text style={styles.section}>Danh mục phổ biến</Text>
        <View style={styles.grid}>
          {categories.map((item) => (
            <View key={item.id} style={styles.cell}>
              <Pressable
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                onPress={() => goToCreate({ categoryId: item.id, title: item.name })}>
                <View style={styles.iconWrap}>
                  {item.iconUrl ? (
                    <Image source={{ uri: item.iconUrl }} style={styles.catIcon} contentFit="contain" />
                  ) : (
                    <Ionicons name={item.icon || 'pricetag-outline'} size={24} color={Colors.primary} />
                  )}
                </View>
                <Text style={styles.tileName} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable style={styles.banner} onPress={() => goToCreate()}>
          <View style={styles.bannerIcon}>
            <Ionicons name="flash" size={22} color={Colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.bannerTitle}>Cần gấp? Đăng việc ngay</Text>
            <Text style={styles.bannerText}>Nhận đề xuất trong vài phút từ người làm việc gần bạn.</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  brand: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginTop: 18,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  section: {
    marginTop: 28,
    marginBottom: 14,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
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
    ...Shadow.soft,
  },
  tilePressed: {
    backgroundColor: Colors.primarySoft,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  banner: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: 'center',
  },
  bannerIcon: {
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
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  bannerText: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
