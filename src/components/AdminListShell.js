import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors } from '@/constants/colors';

const PAGE_SIZES = [15, 30, 50];

export default function AdminListShell({
  title,
  subtitle,
  tabs,
  tab,
  onTab,
  equalTabs = false,
  draft,
  onDraft,
  onApply,
  onClear,
  onAdd,
  dropdowns,
  textKey = 'location',
  textPlaceholder = 'Nhập từ khoá',
  fromRow,
  toRow,
  total,
  pageSize,
  onPageSize,
  pageIndex,
  pageCount,
  onPage,
  children,
}) {
  return (
    <View style={styles.card}>
      {title || onAdd ? (
        <View style={styles.pageHead}>
          <View style={styles.pageCopy}>
            {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.pageSub}>{subtitle}</Text> : null}
          </View>
          {onAdd ? (
            <Pressable style={styles.addBtn} onPress={onAdd}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addText}>Thêm mới</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.tabs, equalTabs && styles.tabsEqual]}>
        {tabs.map((item) => {
          const on = tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.tab, equalTabs && styles.tabEqual, on && styles.tabOn]}
              onPress={() => onTab(item.id)}>
              <Text
                style={[styles.tabText, equalTabs && styles.tabTextEqual, on && styles.tabTextOn]}
                numberOfLines={equalTabs ? 2 : 1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Tìm kiếm"
          placeholderTextColor={Colors.textLight}
          value={draft.query}
          onChangeText={(query) => onDraft({ query })}
        />
        <TextInput
          style={styles.date}
          placeholder="Từ ngày"
          placeholderTextColor={Colors.textLight}
          value={draft.from}
          onChangeText={(from) => onDraft({ from })}
        />
        <TextInput
          style={styles.date}
          placeholder="Đến ngày"
          placeholderTextColor={Colors.textLight}
          value={draft.to}
          onChangeText={(to) => onDraft({ to })}
        />
        <Pressable style={styles.iconBtn} onPress={onApply}>
          <Ionicons name="search" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {dropdowns.map((item) => (
          <SelectBox
            key={item.key}
            value={draft[item.key] || ''}
            placeholder={item.placeholder}
            options={item.options}
            onChange={(value) => onDraft({ [item.key]: value })}
          />
        ))}
        <TextInput
          style={styles.location}
          placeholder={textPlaceholder}
          placeholderTextColor={Colors.textLight}
          value={draft[textKey] || ''}
          onChangeText={(value) => onDraft({ [textKey]: value })}
        />
        <Pressable style={styles.filterBtn} onPress={onApply}>
          <Ionicons name="search" size={14} color="#FFFFFF" />
          <Text style={styles.filterText}>Lọc</Text>
        </Pressable>
        <Pressable style={styles.clearBtn} onPress={onClear}>
          <Ionicons name="close" size={14} color="#FFFFFF" />
          <Text style={styles.filterText}>Xoá lọc</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.tableScroll} contentContainerStyle={styles.tableContent} showsVerticalScrollIndicator>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableWide}>
          <View style={styles.table}>{children}</View>
        </ScrollView>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Hiển thị {fromRow}–{toRow} của {total} dòng
        </Text>
        <View style={styles.pageSize}>
          <Text style={styles.footerText}>Mỗi trang</Text>
          {PAGE_SIZES.map((size) => (
            <Pressable key={size} style={[styles.sizeBtn, pageSize === size && styles.sizeOn]} onPress={() => onPageSize(size)}>
              <Text style={[styles.sizeText, pageSize === size && styles.sizeTextOn]}>{size}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.pager}>
          <Pressable style={styles.pageBtn} onPress={() => onPage(Math.max(0, pageIndex - 1))}>
            <Ionicons name="chevron-back" size={16} color={Colors.primary} />
          </Pressable>
          {Array.from({ length: pageCount }, (_, index) => index)
            .slice(Math.max(0, pageIndex - 2), Math.max(0, pageIndex - 2) + 5)
            .map((index) => (
              <Pressable key={index} style={[styles.pageBtn, index === pageIndex && styles.pageOn]} onPress={() => onPage(index)}>
                <Text style={[styles.pageNum, index === pageIndex && styles.pageNumOn]}>{index + 1}</Text>
              </Pressable>
            ))}
          <Pressable style={styles.pageBtn} onPress={() => onPage(Math.min(pageCount - 1, pageIndex + 1))}>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SelectBox({ value, placeholder, options, onChange }) {
  const [open, setOpen] = useState(false);
  const label = options.find((item) => item.value === value)?.label || placeholder;
  return (
    <View style={styles.selectWrap}>
      <Pressable style={styles.select} onPress={() => setOpen((current) => !current)}>
        <Text style={styles.selectText} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.selectMenu}>
          <ScrollView style={styles.selectScroll} nestedScrollEnabled>
            {options.map((option) => (
              <Pressable
                key={option.value || 'all'}
                style={styles.selectItem}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}>
                <Text style={styles.selectItemText}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  pageCopy: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  pageSub: { color: '#64748B', marginTop: 2, lineHeight: 18 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabsEqual: { flexWrap: 'nowrap', gap: 0, alignItems: 'stretch' },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  tabEqual: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  tabTextEqual: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
  tabTextOn: { color: '#FFFFFF' },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', width: '100%' },
  search: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 140,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
  },
  date: {
    width: 120,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: { color: '#FFFFFF', fontWeight: '800' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', zIndex: 5 },
  location: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 140,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  filterBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F04438',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterText: { color: '#FFFFFF', fontWeight: '800' },
  tableScroll: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? { overflowY: 'scroll' } : null),
  },
  tableContent: { flexGrow: 1 },
  tableWide: { flexGrow: 1, minWidth: '100%' },
  table: { flexGrow: 1, width: '100%', minWidth: 920 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerText: { color: Colors.textMuted, fontSize: 13 },
  pageSize: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sizeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  sizeOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sizeText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  sizeTextOn: { color: '#FFFFFF' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pageOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pageNum: { color: Colors.text, fontWeight: '700' },
  pageNumOn: { color: '#FFFFFF', fontWeight: '800' },
  selectWrap: { flexGrow: 1, flexBasis: 180, minWidth: 160, zIndex: 6 },
  select: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  selectText: { flex: 1, color: Colors.text, fontWeight: '700' },
  selectMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    zIndex: 8,
    elevation: 6,
  },
  selectScroll: { maxHeight: 220 },
  selectItem: { paddingHorizontal: 12, paddingVertical: 10 },
  selectItemText: { color: Colors.text },
});
