import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { POPULAR_CATEGORIES } from '@/data/categories';

export default function PostTaskScreen() {
  const [query, setQuery] = useState('');

  function goToCreate(extra = {}) {
    router.push({
      pathname: '/create',
      params: {
        title: extra.title ?? query,
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

        <Text style={styles.hero}>
          Đăng việc nhanh.{'\n'}
          Nhận việc ngay.
        </Text>
        <Text style={styles.sub}>
          Mô tả nhu cầu trong vài từ — người làm việc sẽ gửi đề xuất.
        </Text>

        <Pressable style={styles.search} onPress={() => goToCreate()}>
          <Ionicons name="search" size={20} color={Colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Bạn cần làm gì? Mô tả ngắn gọn..."
            placeholderTextColor={Colors.textLight}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => goToCreate()}
            returnKeyType="next"
          />
          <Pressable style={styles.goBtn} onPress={() => goToCreate()}>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </Pressable>

        <Text style={styles.section}>Danh mục phổ biến</Text>
        <View style={styles.grid}>
          {POPULAR_CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              onPress={() => goToCreate({ categoryId: item.id, title: item.name })}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={24} color={Colors.primary} />
              </View>
              <Text style={styles.tileName} numberOfLines={2}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="flash" size={22} color={Colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.bannerTitle}>Cần gấp? Đăng việc ngay</Text>
            <Text style={styles.bannerText}>Nhận đề xuất trong vài phút từ người làm việc gần bạn.</Text>
          </View>
        </View>
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  sub: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  search: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 10,
  },
  goBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 12,
  },
  tile: {
    width: 108,
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
    marginTop: 24,
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
