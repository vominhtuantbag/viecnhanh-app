import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import { RangeSlider } from '@/components/RangeSlider';
import { TaskCard } from '@/components/TaskCard';
import { Colors, Radius } from '@/constants/colors';
import { useJobs } from '@/context/JobsContext';
import { useLocation } from '@/context/LocationContext';
import { getCategoryById } from '@/data/categories';
import { useCatalog, visibleMains } from '@/data/catalog';
import { JOB_STATUS, jobFlowStatus } from '@/data/jobs';
import { getProvinceById, getVisibleProvinces, getWardById, sameProvince } from '@/data/locations';
import { haversineKm, jobPoint } from '@/services/geo';

const SORT_OPTIONS = [
  { id: 'newest', name: 'Mới nhất' },
  { id: 'oldest', name: 'Cũ nhất' },
  { id: 'price', name: 'Giá cao nhất' },
  { id: 'priceLow', name: 'Giá thấp nhất' },
  { id: 'near', name: 'Gần tôi nhất' },
  { id: 'recommended', name: 'Được đề xuất' },
];

const PRICE_MAX = 5000000;
const DISTANCE_MAX = 50;

const DEFAULTS = {
  sort: 'newest',
  categoryId: 'all',
  provinceId: 'all',
  wardId: '',
  distance: DISTANCE_MAX,
  priceMin: 0,
  priceMax: PRICE_MAX,
  openOnly: true,
  noOffersOnly: false,
};

export default function BrowseScreen() {
  const catalog = useCatalog();
  const provinces = getVisibleProvinces();
  const categoryChoices = visibleMains(catalog).map((item) => ({ id: item.id, name: item.name }));
  const { jobs, loading, error, refreshJobs, markBrowseSeen, markBrowseBlurred } = useJobs();
  const { point } = useLocation();
  const [filters, setFilters] = useState(DEFAULTS);
  const [draft, setDraft] = useState(DEFAULTS);
  const [sheet, setSheet] = useState(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [areaMenu, setAreaMenu] = useState(null);

  useFocusEffect(
    useCallback(() => {
      markBrowseSeen();
      return () => markBrowseBlurred();
    }, [markBrowseBlurred, markBrowseSeen])
  );

  function openSheet(name) {
    setDraft(filters);
    setCategoryQuery('');
    setAreaQuery('');
    setAreaMenu(null);
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
        wardId: DEFAULTS.wardId,
        distance: DEFAULTS.distance,
        priceMin: DEFAULTS.priceMin,
        priceMax: DEFAULTS.priceMax,
        openOnly: DEFAULTS.openOnly,
        noOffersOnly: DEFAULTS.noOffersOnly,
      }));
      setAreaMenu(null);
      setAreaQuery('');
    }
  }

  const filteredJobs = useMemo(() => {
    const measured = jobs.map((job) => {
      const km = point ? haversineKm(point, jobPoint(job)) : null;
      return { ...job, distanceKm: km ?? job.distanceKm ?? 0, distanceKnown: km != null };
    });
    const next = measured.filter((job) => {
      if (
        filters.categoryId !== 'all' &&
        job.categoryId !== filters.categoryId &&
        getCategoryById(job.categoryId)?.parentId !== filters.categoryId
      ) {
        return false;
      }
      if (filters.provinceId !== 'all' && !sameProvince(job.provinceId, filters.provinceId)) return false;
      if (filters.wardId && job.wardId !== filters.wardId) return false;
      if (point && filters.distance < DISTANCE_MAX && (!job.distanceKnown || job.distanceKm > filters.distance)) {
        return false;
      }
      if (job.price < filters.priceMin) return false;
      if (filters.priceMax < PRICE_MAX && job.price > filters.priceMax) return false;
      const flow = jobFlowStatus(job);
      if (filters.openOnly && flow !== JOB_STATUS.APPROVED) return false;
      if (!filters.openOnly && flow !== JOB_STATUS.APPROVED && flow !== JOB_STATUS.ASSIGNED) return false;
      if (filters.noOffersOnly && (job.quotes?.length ?? 0) > 0) return false;
      return true;
    });

    next.sort((a, b) => {
      if (filters.sort === 'price') return b.price - a.price;
      if (filters.sort === 'priceLow') return a.price - b.price;
      if (filters.sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (filters.sort === 'near') {
        return (a.distanceKnown ? a.distanceKm : 99999) - (b.distanceKnown ? b.distanceKm : 99999);
      }
      if (filters.sort === 'recommended') return b.views - a.views;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return next;
  }, [jobs, filters, point]);

  const sortName = SORT_OPTIONS.find((item) => item.id === filters.sort)?.name ?? 'Mới nhất';
  const categoryName =
    filters.categoryId === 'all'
      ? 'Danh mục'
      : categoryChoices.find((item) => item.id === filters.categoryId)?.name ?? 'Danh mục';
  const detailsOn = hasDetails(filters);

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
        <Chip
          label={sortName}
          active={filters.sort !== 'newest'}
          onPress={() => openSheet('sort')}
        />
        <Chip
          label={categoryName}
          active={filters.categoryId !== 'all'}
          onPress={() => openSheet('category')}
        />
        <Chip label="Chi tiết" active={detailsOn} onPress={() => openSheet('more')} />
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
        title="Chi tiết"
        onClose={() => setSheet(null)}
        footer={<SheetFooter onReset={resetDraft} onApply={applyDraft} />}>
        <ScrollView
          style={styles.detailScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.group}>Khu vực</Text>
          <AreaField
            label="Tỉnh / Thành phố"
            value={draft.provinceId === 'all' ? 'Tất cả' : getProvinceById(draft.provinceId)?.name || 'Tất cả'}
            open={areaMenu === 'province'}
            onPress={() => {
              setAreaQuery('');
              setAreaMenu((current) => (current === 'province' ? null : 'province'));
            }}
          />
          {areaMenu === 'province' ? (
            <AreaList
              query={areaQuery}
              onQuery={setAreaQuery}
              options={[{ id: 'all', name: 'Tất cả' }, ...provinces.map((item) => ({ id: item.id, name: item.name }))]}
              selected={draft.provinceId}
              onSelect={(id) => {
                setDraft((current) => ({ ...current, provinceId: id, wardId: '' }));
                setAreaMenu(null);
              }}
            />
          ) : null}
          <AreaField
            label="Xã / Phường"
            value={
              draft.provinceId === 'all'
                ? 'Chọn tỉnh trước'
                : getWardById(draft.provinceId, draft.wardId)?.name || 'Tất cả'
            }
            disabled={draft.provinceId === 'all'}
            open={areaMenu === 'ward'}
            onPress={() => {
              setAreaQuery('');
              setAreaMenu((current) => (current === 'ward' ? null : 'ward'));
            }}
          />
          {areaMenu === 'ward' && draft.provinceId !== 'all' ? (
            <AreaList
              query={areaQuery}
              onQuery={setAreaQuery}
              options={[
                { id: '', name: 'Tất cả' },
                ...(provinces.find((item) => item.id === draft.provinceId)?.wards ?? []).map((item) => ({
                  id: item.id,
                  name: item.name,
                })),
              ]}
              selected={draft.wardId}
              onSelect={(id) => {
                setDraft((current) => ({ ...current, wardId: id }));
                setAreaMenu(null);
              }}
            />
          ) : null}

          <Text style={styles.group}>Khoảng cách</Text>
          <Text style={styles.sliderValue}>{distanceLabel(draft.distance)}</Text>
          {point ? null : (
            <Text style={styles.hint}>Bật vị trí để lọc việc gần bạn. Chưa có vị trí thì mục này chưa áp dụng.</Text>
          )}
          <RangeSlider
            single
            min={1}
            max={DISTANCE_MAX}
            step={1}
            low={1}
            high={draft.distance}
            onChange={(_low, next) => setDraft((current) => ({ ...current, distance: next }))}
          />
          <View style={styles.scale}>
            <Text style={styles.scaleText}>1 km</Text>
            <Text style={styles.scaleText}>50 km</Text>
          </View>

          <Text style={styles.group}>Mức giá</Text>
          <Text style={styles.sliderValue}>{priceLabel(draft.priceMin, draft.priceMax)}</Text>
          <RangeSlider
            min={0}
            max={PRICE_MAX}
            step={100000}
            low={draft.priceMin}
            high={draft.priceMax}
            onChange={(nextLow, nextHigh) =>
              setDraft((current) => ({ ...current, priceMin: nextLow, priceMax: nextHigh }))
            }
          />
          <View style={styles.scale}>
            <Text style={styles.scaleText}>0 đ</Text>
            <Text style={styles.scaleText}>5 triệu</Text>
          </View>

          <ToggleRow
            label="Tin đang mở"
            value={draft.openOnly}
            onValueChange={(value) => setDraft((current) => ({ ...current, openOnly: value }))}
          />
          <ToggleRow
            label="Tin chưa có báo giá"
            value={draft.noOffersOnly}
            onValueChange={(value) => setDraft((current) => ({ ...current, noOffersOnly: value }))}
          />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function hasDetails(filters) {
  return (
    filters.provinceId !== 'all' ||
    Boolean(filters.wardId) ||
    filters.distance < DISTANCE_MAX ||
    filters.priceMin > 0 ||
    filters.priceMax < PRICE_MAX ||
    !filters.openOnly ||
    filters.noOffersOnly
  );
}

function distanceLabel(km) {
  if (km >= DISTANCE_MAX) return 'Không giới hạn';
  return `Trong ${km} km`;
}

function priceLabel(min, max) {
  if (min <= 0 && max >= PRICE_MAX) return 'Mọi mức giá';
  const ceiling = max >= PRICE_MAX ? '5 triệu trở lên' : formatMoney(max);
  if (min <= 0) return `Đến ${ceiling}`;
  return `${formatMoney(min)} – ${ceiling}`;
}

function formatMoney(value) {
  if (value >= 1000000) {
    const millions = value / 1000000;
    const text = Number.isInteger(millions) ? String(millions) : millions.toFixed(1);
    return `${text} triệu`;
  }
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipValue, active && styles.chipValueActive]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={active ? Colors.primary : Colors.textMuted} />
    </Pressable>
  );
}

function AreaField({ label, value, open, disabled, onPress }) {
  return (
    <Pressable
      style={[styles.areaField, disabled && styles.areaDisabled, open && styles.areaOpen]}
      onPress={onPress}
      disabled={disabled}>
      <View style={styles.areaCopy}>
        <Text style={styles.areaLabel}>{label}</Text>
        <Text style={styles.areaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

function AreaList({ query, onQuery, options, selected, onSelect }) {
  const text = query.trim().toLowerCase();
  const rows = text ? options.filter((item) => item.name.toLowerCase().includes(text)) : options;
  return (
    <View style={styles.areaList}>
      <TextInput
        style={styles.areaSearch}
        placeholder="Tìm tên"
        placeholderTextColor={Colors.textLight}
        value={query}
        onChangeText={onQuery}
      />
      <ScrollView style={styles.areaScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {rows.map((item) => (
          <Pressable key={item.id || 'all-ward'} style={styles.option} onPress={() => onSelect(item.id)}>
            <Text style={[styles.optionText, selected === item.id && styles.optionActive]}>{item.name}</Text>
            {selected === item.id ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    zIndex: 10,
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0 } : null),
  },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    gap: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  chipValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  chipValueActive: {
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
  detailScroll: {
    maxHeight: 380,
  },
  group: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  areaField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  areaOpen: {
    borderColor: Colors.primary,
  },
  areaDisabled: {
    opacity: 0.5,
  },
  areaCopy: {
    flex: 1,
    minWidth: 0,
  },
  areaLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  areaValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  areaList: {
    marginTop: -4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
  },
  areaSearch: {
    height: 40,
    color: Colors.text,
  },
  areaScroll: {
    maxHeight: 160,
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
