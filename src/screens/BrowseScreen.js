import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect } from 'expo-router';

import { BottomSheet, SheetFooter } from '@/components/BottomSheet';
import { TaskCard } from '@/components/TaskCard';
import { Colors, Radius } from '@/constants/colors';
import { useJobs } from '@/context/JobsContext';
import { getCategoryById } from '@/data/categories';
import { useCatalog, visibleMains } from '@/data/catalog';
import { isJobLive } from '@/data/jobs';
import { getProvinceById, getVisibleProvinces, sameProvince } from '@/data/locations';

const SORT_OPTIONS = [
  { id: 'newest', name: 'Mới nhất' },
  { id: 'recommended', name: 'Được đề xuất' },
  { id: 'near', name: 'Gần tôi nhất' },
  { id: 'price', name: 'Giá cao nhất' },
];

const DISTANCE_OPTIONS = [
  { id: 'all', name: 'Mọi khoảng cách' },
  { id: '5', name: '5 km' },
  { id: '10', name: '10 km' },
  { id: '25', name: '25 km' },
];

const PRICE_OPTIONS = [
  { id: 'all', name: 'Mọi mức giá' },
  { id: '300', name: 'Dưới 300.000 đ' },
  { id: '500', name: 'Dưới 500.000 đ' },
  { id: '1000', name: 'Dưới 1.000.000 đ' },
];

const DEFAULTS = {
  sort: 'newest',
  categoryId: 'all',
  provinceId: 'all',
  radius: 'all',
  price: 'all',
  availableOnly: false,
  noOffersOnly: false,
};

export default function BrowseScreen() {
  const catalog = useCatalog();
  const provinces = getVisibleProvinces();
  const categoryChoices = visibleMains(catalog).map((item) => ({ id: item.id, name: item.name }));
  const { jobs, loading, error, refreshJobs, markBrowseSeen, markBrowseBlurred } = useJobs();
  const [filters, setFilters] = useState(DEFAULTS);
  const [draft, setDraft] = useState(DEFAULTS);
  const [sheet, setSheet] = useState(null);
  const [categoryQuery, setCategoryQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      markBrowseSeen();
      return () => markBrowseBlurred();
    }, [markBrowseBlurred, markBrowseSeen])
  );

  function openSheet(name) {
    setDraft(filters);
    setCategoryQuery('');
    setSheet(name);
  }

  function applyDraft() {
    setFilters(draft);
    setSheet(null);
  }

  function resetDraft() {
    if (sheet === 'sort') setDraft((current) => ({ ...current, sort: DEFAULTS.sort }));
    if (sheet === 'category') setDraft((current) => ({ ...current, categoryId: DEFAULTS.categoryId }));
    if (sheet === 'more') {
      setDraft((current) => ({
        ...current,
        provinceId: DEFAULTS.provinceId,
        radius: DEFAULTS.radius,
        price: DEFAULTS.price,
        availableOnly: false,
        noOffersOnly: false,
      }));
    }
  }

  const filteredJobs = useMemo(() => {
    const next = jobs.filter((job) => {
      if (
        filters.categoryId !== 'all' &&
        job.categoryId !== filters.categoryId &&
        getCategoryById(job.categoryId)?.parentId !== filters.categoryId
      ) {
        return false;
      }
      if (filters.provinceId !== 'all' && !sameProvince(job.provinceId, filters.provinceId)) return false;
      if (filters.radius !== 'all' && job.distanceKm > Number(filters.radius)) return false;
      if (filters.price !== 'all' && job.price > Number(filters.price) * 1000) return false;
      if (!isJobLive(job)) return false;
      if (filters.availableOnly && !isJobLive(job)) return false;
      if (filters.noOffersOnly && (job.quotes?.length ?? 0) > 0) return false;
      return true;
    });

    next.sort((a, b) => {
      if (filters.sort === 'price') return b.price - a.price;
      if (filters.sort === 'near') return a.distanceKm - b.distanceKm;
      if (filters.sort === 'recommended') return b.views - a.views;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return next;
  }, [jobs, filters, catalog]);

  const province = getProvinceById(filters.provinceId);
  const cityName = shortCity(province?.name);
  const distanceChip =
    filters.radius === 'all' && filters.provinceId === 'all'
      ? 'Mọi khu vực'
      : filters.radius === 'all'
        ? cityName
        : filters.provinceId === 'all'
          ? `${filters.radius}km`
          : `${filters.radius}km tại ${cityName}`;
  const sortName = SORT_OPTIONS.find((item) => item.id === filters.sort)?.name;
  const categoryName =
    filters.categoryId === 'all'
      ? 'Tất cả'
      : categoryChoices.find((item) => item.id === filters.categoryId)?.name;

  const categoryResults = categoryChoices.filter((item) =>
    item.name.toLowerCase().includes(categoryQuery.trim().toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Khám phá công việc</Text>
        <Text style={styles.count}>{filteredJobs.length} việc gần bạn</Text>
      </View>

      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filters}>
          <Chip label="Sắp xếp" value={sortName} onPress={() => openSheet('sort')} />
          <Chip label="Danh mục" value={categoryName} onPress={() => openSheet('category')} />
          <Chip label="Khu vực" value={distanceChip} onPress={() => openSheet('more')} />
        </ScrollView>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        style={styles.listWrap}
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>Không có việc phù hợp bộ lọc.</Text>
          )
        }
        renderItem={({ item }) => <TaskCard job={item} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshJobs} />}
        showsVerticalScrollIndicator={false}
      />

      <BottomSheet
        visible={sheet === 'sort'}
        title="Sắp xếp theo"
        onClose={() => setSheet(null)}
        footer={<SheetFooter onReset={resetDraft} onApply={applyDraft} />}>
        {SORT_OPTIONS.map((item) => (
          <OptionRow
            key={item.id}
            label={item.name}
            selected={draft.sort === item.id}
            onPress={() => setDraft((current) => ({ ...current, sort: item.id }))}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'category'}
        title="Danh mục"
        onClose={() => setSheet(null)}
        footer={<SheetFooter onReset={resetDraft} onApply={applyDraft} />}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm danh mục"
            placeholderTextColor={Colors.textLight}
            value={categoryQuery}
            onChangeText={setCategoryQuery}
          />
        </View>
        <ScrollView style={styles.sheetList}>
          <OptionRow
            label="Tất cả danh mục"
            selected={draft.categoryId === 'all'}
            onPress={() => setDraft((current) => ({ ...current, categoryId: 'all' }))}
          />
          {categoryResults.map((item) => (
            <OptionRow
              key={item.id}
              label={item.name}
              selected={draft.categoryId === item.id}
              onPress={() => setDraft((current) => ({ ...current, categoryId: item.id }))}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'more'}
        title="Bộ lọc"
        onClose={() => setSheet(null)}
        footer={<SheetFooter onReset={resetDraft} onApply={applyDraft} />}>
        <Text style={styles.group}>Địa điểm</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          <Pressable
            style={[styles.pill, draft.provinceId === 'all' && styles.pillActive]}
            onPress={() => setDraft((current) => ({ ...current, provinceId: 'all' }))}>
            <Text style={[styles.pillText, draft.provinceId === 'all' && styles.pillTextActive]}>
              Tất cả
            </Text>
          </Pressable>
          {provinces.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.pill, draft.provinceId === item.id && styles.pillActive]}
              onPress={() => setDraft((current) => ({ ...current, provinceId: item.id }))}>
              <Text style={[styles.pillText, draft.provinceId === item.id && styles.pillTextActive]}>
                {shortCity(item.name)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.group}>Khoảng cách</Text>
        {DISTANCE_OPTIONS.map((item) => (
          <OptionRow
            key={item.id}
            label={item.name}
            selected={draft.radius === item.id}
            onPress={() => setDraft((current) => ({ ...current, radius: item.id }))}
          />
        ))}

        <Text style={styles.group}>Mức giá</Text>
        {PRICE_OPTIONS.map((item) => (
          <OptionRow
            key={item.id}
            label={item.name}
            selected={draft.price === item.id}
            onPress={() => setDraft((current) => ({ ...current, price: item.id }))}
          />
        ))}

        <ToggleRow
          label="Chỉ hiển thị công việc còn nhận"
          value={draft.availableOnly}
          onValueChange={(value) => setDraft((current) => ({ ...current, availableOnly: value }))}
        />
        <ToggleRow
          label="Hiển thị công việc chưa có đề xuất"
          value={draft.noOffersOnly}
          onValueChange={(value) => setDraft((current) => ({ ...current, noOffersOnly: value }))}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

function shortCity(name = '') {
  if (name.includes('Hồ Chí Minh')) return 'TPHCM';
  return name;
}

function Chip({ label, value, onPress }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="chevron-down" size={14} color={Colors.primary} />
    </Pressable>
  );
}

function OptionRow({ label, selected, onPress }) {
  return (
    <Pressable style={styles.option} onPress={onPress}>
      <Text style={[styles.optionText, selected && styles.optionActive]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
    </Pressable>
  );
}

function ToggleRow({ label, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.primarySoft }}
        thumbColor={value ? Colors.primary : '#F4F4F5'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  count: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textMuted,
  },
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    height: 36,
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    maxWidth: 220,
  },
  chipLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  chipValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  error: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    color: '#D92D20',
    fontSize: 13,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  loader: {
    marginTop: 48,
  },
  gap: {
    height: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    color: Colors.textMuted,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: Colors.background,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: Colors.text,
  },
  sheetList: {
    maxHeight: 280,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionText: {
    flex: 1,
    paddingRight: 12,
    fontSize: 15,
    color: Colors.text,
  },
  optionActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  group: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  pills: {
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  pillText: {
    fontWeight: '700',
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
    fontWeight: '600',
  },
});
