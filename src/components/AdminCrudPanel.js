import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '@/constants/colors';
import { formatPrice } from '@/data/jobs';

const BLUE = Colors.primary;

function showValue(field, value) {
  if (value == null || value === '') return '—';
  if (field.type === 'select') {
    return field.options?.find((item) => item.value === value)?.label || String(value);
  }
  if (field.money) return formatPrice(value);
  return String(value);
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
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState({});
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter((row) =>
      fields.some((field) => showValue(field, row[field.key]).toLowerCase().includes(key))
    );
  }, [fields, query, rows]);

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
    onCommit(editor?.mode === 'edit' ? 'update' : 'create', { ...current, ...draft, id: editor?.id });
    setEditor(null);
  };

  return (
    <View>
      <Text style={styles.hint}>{page.hint}</Text>
      <Text style={styles.sample}>
        {page.live
          ? 'Mỗi dòng có nút Sửa và Xoá. Dòng thêm mới dùng để thử trên màn hình; sửa hoặc xoá dòng có sẵn sẽ ghi vào dữ liệu thật nếu hệ thống cho phép.'
          : 'Dữ liệu mẫu để bấm thử. Thêm, sửa và xoá có hiệu lực ngay trên màn hình này.'}
      </Text>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Tìm trong danh sách"
          value={query}
          onChangeText={setQuery}
        />
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addText}>Thêm</Text>
        </Pressable>
      </View>

      <View style={styles.table}>
        {visible.length === 0 ? (
          <Text style={styles.empty}>Chưa có mục nào. Bấm Thêm để tạo mới, rồi có thể sửa hoặc xoá.</Text>
        ) : (
          visible.map((row) => {
            const titleField = fields.find((field) => row[field.key]);
            const title = titleField ? showValue(titleField, row[titleField.key]) : 'Chưa có tên';
            const meta = fields
              .filter((field) => field.key !== titleField?.key)
              .map((field) => showValue(field, row[field.key]))
              .filter((value) => value && value !== '—')
              .join(' · ');
            return (
              <View key={row.id} style={styles.tr}>
                <View style={styles.td}>
                  <Text style={styles.title}>{title}</Text>
                  {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                </View>
                <Pressable style={styles.editBtn} onPress={() => openEdit(row)}>
                  <Text style={styles.editText}>Sửa</Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => setPendingDelete(row)}>
                  <Text style={styles.deleteText}>Xoá</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{editor?.mode === 'edit' ? 'Sửa' : 'Thêm mới'}</Text>
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
              {fields
                .filter((field) => field.editable !== false)
                .map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    {field.type === 'select' ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: '#64748B', marginBottom: 6, lineHeight: 20 },
  sample: { color: '#B45309', marginBottom: 12, lineHeight: 20 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  search: {
    flex: 1,
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
  table: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  empty: { color: '#64748B', padding: 16, lineHeight: 20 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  td: { flex: 1 },
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
  formScroll: { flexGrow: 0 },
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
