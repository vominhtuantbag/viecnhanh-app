import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import { Colors } from '@/constants/colors';
import { formatPrice } from '@/data/jobs';
import AdminListShell from '@/components/AdminListShell';
import { uploadPublicImage } from '@/services/homeContent';

const BLUE = Colors.primary;

function parseDay(text) {
  const match = String(text || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}

function showValue(field, value) {
  if (value == null || value === '') return '—';
  if (field.type === 'select') {
    return field.options?.find((item) => item.value === value)?.label || String(value);
  }
  if (field.money) return formatPrice(value);
  return String(value);
}

function pillLook(value) {
  const key = String(value || '');
  if (['show', 'on', 'completed', 'accepted', 'approved', 'active'].includes(key)) {
    return { color: Colors.success, bg: Colors.successSoft || '#ECFDF3' };
  }
  if (['hide', 'off', 'rejected', 'banned', 'closed'].includes(key)) {
    return { color: '#B42318', bg: '#FEF3F2' };
  }
  if (['pending', 'waiting'].includes(key)) {
    return { color: '#B54708', bg: '#FFFAEB' };
  }
  return { color: Colors.primary, bg: Colors.primarySoft };
}

function emptyDraft(fields) {
  const draft = {};
  for (const field of fields) {
    if (field.editable === false) continue;
    draft[field.key] = field.type === 'select' ? field.options?.[0]?.value || '' : '';
  }
  return draft;
}

export default function AdminCrudPanel({ page, rows, onCommit }) {
  const fields = page.fields || [];
  const selects = fields.filter((field) => field.type === 'select');
  const tabField = selects.find((field) => field.tab) || selects[0];
  const filterSelects = selects.filter((field) => field !== tabField);
  const textField = fields.find((field) => field.type !== 'select');
  const [tab, setTab] = useState('all');
  const [draftFilters, setDraftFilters] = useState({ query: '', from: '', to: '', extra: '' });
  const [filters, setFilters] = useState(draftFilters);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState({});
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [actionRow, setActionRow] = useState(null);
  const [uploadingKey, setUploadingKey] = useState('');
  const filterStamp = `${tab}|${pageSize}|${filters.query}|${filters.from}|${filters.to}|${filters.extra}|${filters.extraPick || ''}`;
  const [seenStamp, setSeenStamp] = useState(filterStamp);
  let activePage = pageIndex;
  if (seenStamp !== filterStamp) {
    setSeenStamp(filterStamp);
    setPageIndex(0);
    activePage = 0;
  }

  const tabs = tabField
    ? [{ id: 'all', label: 'Tất cả' }].concat((tabField.options || []).map((item) => ({ id: item.value, label: item.label })))
    : [{ id: 'all', label: 'Tất cả' }];

  const dropdowns = filterSelects.map((field) => ({
    key: field.key,
    placeholder: `Tất cả ${field.label.toLowerCase()}`,
    options: [{ value: '', label: `Tất cả ${field.label.toLowerCase()}` }].concat(field.options || []),
  }));
  if (dropdowns.length < 2 && textField) {
    const values = [];
    rows.forEach((row) => {
      const value = String(row[textField.key] || '').trim();
      if (value && !values.includes(value)) values.push(value);
    });
    dropdowns.push({
      key: 'extraPick',
      placeholder: `Tất cả ${textField.label.toLowerCase()}`,
      options: [{ value: '', label: `Tất cả ${textField.label.toLowerCase()}` }].concat(
        values.map((value) => ({ value, label: value }))
      ),
    });
  }
  while (dropdowns.length < 2) {
    dropdowns.push({
      key: `spare-${dropdowns.length}`,
      placeholder: 'Tất cả',
      options: [{ value: '', label: 'Tất cả' }],
    });
  }

  const query = filters.query.trim().toLowerCase();
  const extra = String(filters.extra || '').trim().toLowerCase();
  const filtered = rows.filter((row) => {
      if (tabField && tab !== 'all' && String(row[tabField.key] || '') !== tab) return false;
      for (const field of filterSelects) {
        if (filters[field.key] && String(row[field.key] || '') !== filters[field.key]) return false;
      }
      if (filters.extraPick && textField && String(row[textField.key] || '') !== filters.extraPick) return false;
      if (filters.from || filters.to) {
        const date = new Date(row.createdAt);
        if (Number.isNaN(date.getTime())) return false;
        const stamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const from = parseDay(filters.from);
        const to = parseDay(filters.to);
        if (from && stamp < from) return false;
        if (to && stamp > to) return false;
      }
      const blob = fields.map((field) => showValue(field, row[field.key])).join(' ').toLowerCase();
      if (query && !blob.includes(query)) return false;
      if (extra && !blob.includes(extra)) return false;
      return true;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(activePage, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const fromRow = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const toRow = Math.min(filtered.length, (safePage + 1) * pageSize);
  const blank = { query: '', from: '', to: '', extra: '', extraPick: '' };

  const openCreate = () => {
    setFormError('');
    setDraft(emptyDraft(fields));
    setEditor({ mode: 'create' });
  };

  const openEdit = (row) => {
    setFormError('');
    const next = {};
    for (const field of fields) {
      if (field.editable === false) continue;
      next[field.key] = row[field.key] == null ? '' : String(row[field.key]);
    }
    setDraft(next);
    setEditor({ mode: 'edit', id: row.id });
  };

  const save = () => {
    for (const field of fields) {
      if (field.editable === false || !field.required) continue;
      if (!String(draft[field.key] || '').trim()) {
        setFormError(`Cần nhập ${field.label.toLowerCase()}.`);
        return;
      }
    }
    const current = rows.find((row) => row.id === editor?.id) || {};
    const payload = { ...current, ...draft };
    if (editor?.mode === 'edit' && editor.id) payload.id = editor.id;
    else delete payload.id;
    Promise.resolve(onCommit(editor?.mode === 'edit' ? 'update' : 'create', payload))
      .then(() => setEditor(null))
      .catch((err) => setFormError(err?.message || 'Không lưu được.'));
  };

  const pickImage = (field) => {
    const doc = globalThis.document;
    if (Platform.OS !== 'web' || !doc) {
      setFormError('Trên điện thoại hãy dán đường dẫn ảnh bắt đầu bằng https://. Trên máy tính, dùng nút Chọn ảnh.');
      return;
    }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = field.bucket === 'category-icons' ? 'image/*,.svg' : 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setUploadingKey(field.key);
      setFormError('');
      try {
        const url = await uploadPublicImage(field.bucket || 'banner-images', file);
        setDraft((current) => ({ ...current, [field.key]: url }));
      } catch (err) {
        setFormError(err.message || 'Không tải được ảnh.');
      } finally {
        setUploadingKey('');
      }
    };
    input.click();
  };

  const formTitle =
    page.id === 'categories-main'
      ? editor?.mode === 'edit'
        ? 'Chỉnh sửa danh mục'
        : 'Thêm danh mục'
      : editor?.mode === 'edit'
        ? 'Sửa'
        : 'Thêm mới';

  return (
    <>
      <AdminListShell
        title={page.label}
        subtitle={page.hint}
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        draft={draftFilters}
        onDraft={(patch) => setDraftFilters((current) => ({ ...current, ...patch }))}
        onApply={() => setFilters(draftFilters)}
        onClear={() => {
          setDraftFilters(blank);
          setFilters(blank);
          setTab('all');
        }}
        onAdd={page.allowCreate === false ? undefined : openCreate}
        dropdowns={dropdowns.slice(0, 2)}
        textKey="extra"
        textPlaceholder={textField ? `Nhập ${textField.label.toLowerCase()}` : 'Nhập từ khoá'}
        fromRow={fromRow}
        toRow={toRow}
        total={filtered.length}
        pageSize={pageSize}
        onPageSize={setPageSize}
        pageIndex={safePage}
        pageCount={pageCount}
        onPage={setPageIndex}>
        <View style={styles.head}>
          <Text style={[styles.th, styles.colIndex]}>#</Text>
          {fields.map((field) => (
            <Text key={field.key} style={[styles.th, styles.col]} numberOfLines={1}>
              {field.label}
            </Text>
          ))}
          <Text style={[styles.th, styles.colAction]} />
        </View>
        {visible.length === 0 ? (
          <Text style={styles.empty}>
            {page.allowCreate === false
              ? 'Chưa có yêu cầu nào. Yêu cầu xuất hiện khi người dùng bấm Đổi ngay.'
              : 'Chưa có mục nào. Bấm Thêm mới, rồi dùng nút ba chấm để sửa hoặc xoá.'}
          </Text>
        ) : (
          visible.map((row, index) => (
            <View key={row.id} style={styles.tr}>
              <Text style={[styles.td, styles.colIndex]}>{fromRow + index}</Text>
              {fields.map((field) =>
                field.type === 'image' ? (
                  <View key={field.key} style={styles.col}>
                    {row[field.key] ? (
                      <Image source={{ uri: String(row[field.key]) }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <Text style={styles.td}>—</Text>
                    )}
                  </View>
                ) : field.type === 'select' && (field.key === 'status' || field.tab) ? (
                  <View key={field.key} style={styles.col}>
                    <View style={[styles.pill, { backgroundColor: pillLook(row[field.key]).bg }]}>
                      <Text style={[styles.pillText, { color: pillLook(row[field.key]).color }]} numberOfLines={1}>
                        {showValue(field, row[field.key])}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text key={field.key} style={[styles.td, styles.col]} numberOfLines={1}>
                    {showValue(field, row[field.key])}
                  </Text>
                )
              )}
              <Pressable style={styles.more} onPress={() => setActionRow(row)}>
                <Ionicons name="ellipsis-vertical" size={16} color={Colors.textMuted} />
              </Pressable>
            </View>
          ))
        )}
      </AdminListShell>

      <Modal visible={!!actionRow} transparent animationType="fade" onRequestClose={() => setActionRow(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thao tác</Text>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                const row = actionRow;
                setActionRow(null);
                openEdit(row);
              }}>
              <Text style={styles.editText}>Sửa</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setPendingDelete(actionRow);
                setActionRow(null);
              }}>
              <Text style={styles.deleteText}>Xoá</Text>
            </Pressable>
            <Pressable onPress={() => setActionRow(null)}>
              <Text style={styles.ghostText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{formTitle}</Text>
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
              {fields
                .filter((field) => field.editable !== false)
                .map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    {field.type === 'image' ? (
                      <View style={styles.imageField}>
                        {draft[field.key] ? (
                          <Image source={{ uri: String(draft[field.key]) }} style={styles.preview} contentFit="cover" />
                        ) : (
                          <View style={styles.previewEmpty}>
                            <Ionicons name="image-outline" size={22} color={Colors.textLight} />
                          </View>
                        )}
                        <TextInput
                          style={styles.input}
                          value={draft[field.key] || ''}
                          autoCapitalize="none"
                          placeholder="https://..."
                          placeholderTextColor={Colors.textLight}
                          onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                        />
                        <Pressable style={styles.uploadBtn} onPress={() => pickImage(field)} disabled={!!uploadingKey}>
                          <Text style={styles.uploadText}>
                            {uploadingKey === field.key ? 'Đang tải...' : 'Chọn ảnh'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : field.type === 'select' ? (
                      <View style={styles.choices}>
                        {(field.options || []).map((option) => {
                          const on = draft[field.key] === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              style={[styles.choice, on && styles.choiceOn]}
                              onPress={() => setDraft((current) => ({ ...current, [field.key]: option.value }))}>
                              <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{option.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <TextInput
                        style={styles.input}
                        value={draft[field.key] || ''}
                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                        onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                      />
                    )}
                  </View>
                ))}
            </ScrollView>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <View style={styles.cardActions}>
              <Pressable style={styles.ghost} onPress={() => setEditor(null)}>
                <Text style={styles.ghostText}>Huỷ</Text>
              </Pressable>
              <Pressable style={styles.save} onPress={save}>
                <Text style={styles.saveText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Xoá mục này?</Text>
            <Text style={styles.meta}>Mục sẽ biến khỏi danh sách. Thao tác này dành cho quản trị.</Text>
            <View style={styles.cardActions}>
              <Pressable style={styles.ghost} onPress={() => setPendingDelete(null)}>
                <Text style={styles.ghostText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={styles.deleteSolid}
                onPress={() => {
                  onCommit('delete', pendingDelete);
                  setPendingDelete(null);
                }}>
                <Text style={styles.saveText}>Xoá</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  listScroll: { flex: 1, minHeight: 0 },
  hint: { color: '#64748B', marginBottom: 6, lineHeight: 20 },
  sample: { color: '#B45309', marginBottom: 12, lineHeight: 20 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' },
  search: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  addBtn: {
    backgroundColor: BLUE,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: '#FFFFFF', fontWeight: '800' },
  table: { flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  empty: { color: '#64748B', padding: 16, lineHeight: 20 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    minHeight: 44,
  },
  th: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  colIndex: { width: 44, flexGrow: 0, paddingHorizontal: 8 },
  col: { flex: 1, minWidth: 120, paddingRight: 8 },
  colAction: { width: 44, flexGrow: 0 },
  more: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
  menuItem: { minHeight: 44, justifyContent: 'center' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  td: { color: '#0F172A', fontSize: 13 },
  title: { fontWeight: '700', color: '#0F172A' },
  meta: { color: '#64748B', fontSize: 12, marginTop: 2, lineHeight: 18 },
  editBtn: { backgroundColor: Colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editText: { color: BLUE, fontWeight: '800' },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  deleteText: { color: '#DC2626', fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  formScroll: { flexGrow: 0, maxHeight: 420 },
  thumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F2F4F7' },
  imageField: { gap: 8 },
  preview: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F2F4F7' },
  previewEmpty: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtn: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { fontWeight: '800', color: '#0F172A' },
  field: { marginBottom: 10 },
  fieldLabel: { fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  choiceOn: { backgroundColor: Colors.primarySoft },
  choiceText: { color: '#334155', fontWeight: '700' },
  choiceTextOn: { color: BLUE },
  error: { color: '#DC2626', marginTop: 4 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  ghost: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  ghostText: { fontWeight: '800', color: '#334155' },
  save: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
  deleteSolid: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
});
