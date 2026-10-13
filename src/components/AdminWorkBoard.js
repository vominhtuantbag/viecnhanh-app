import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors } from '@/constants/colors';
import { CATEGORIES, getCategoryById } from '@/data/categories';
import { formatPrice } from '@/data/jobs';

const POST_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'approved', label: 'Đang mở' },
  { id: 'assigned', label: 'Đã nhận' },
  { id: 'completed', label: 'Hoàn thành' },
  { id: 'closed', label: 'Đã huỷ' },
];

const BID_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ chọn' },
  { id: 'accepted', label: 'Được chọn' },
  { id: 'rejected', label: 'Từ chối' },
];

const REVIEW_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: '5', label: '5 sao' },
  { id: '4', label: '4 sao' },
  { id: '3', label: '3 sao' },
  { id: '2', label: '2 sao' },
  { id: '1', label: '1 sao' },
];

const PAGE_SIZES = [15, 30, 50];

const STATUS_LOOK = {
  pending: { label: 'Chờ duyệt', color: '#B54708', bg: '#FFFAEB' },
  approved: { label: 'Đang mở', color: Colors.success, bg: Colors.successSoft },
  assigned: { label: 'Đã nhận', color: '#B54708', bg: '#FFFAEB' },
  completed: { label: 'Hoàn thành', color: Colors.success, bg: Colors.successSoft },
  closed: { label: 'Đã huỷ', color: Colors.textMuted, bg: '#F2F4F7' },
  accepted: { label: 'Được chọn', color: Colors.success, bg: Colors.successSoft },
  rejected: { label: 'Từ chối', color: '#B42318', bg: '#FEF3F2' },
  cancelled: { label: 'Đã rút', color: Colors.primary, bg: Colors.primarySoft },
};

function formatAdminDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function parseFilterDate(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function sameDayOrRange(createdAt, fromText, toText) {
  const from = parseFilterDate(fromText);
  const to = parseFilterDate(toText);
  if (!from && !to) return true;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;
  const stamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (from && stamp < new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) return false;
  if (to && stamp > new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()) return false;
  return true;
}

function emptyDraft(fields) {
  const draft = {};
  for (const field of fields) {
    draft[field.key] = field.type === 'select' ? field.options?.[0]?.value || '' : '';
  }
  return draft;
}

export default function AdminWorkBoard({ page, rows, people, onCommit }) {
  const fields = page.fields || [];
  const [tab, setTab] = useState('all');
  const [draftFilters, setDraftFilters] = useState({ query: '', from: '', to: '', category: '', user: '', location: '' });
  const [filters, setFilters] = useState(draftFilters);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState({});
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [actionRow, setActionRow] = useState(null);

  useEffect(() => {
    setPageIndex(0);
  }, [tab, filters, pageSize, page.id]);

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return rows.filter((row) => {
      if (page.board === 'posts' && tab !== 'all' && row.status !== tab) return false;
      if (page.board === 'bids' && tab !== 'all' && row.status !== tab) return false;
      if (page.board === 'reviews' && tab !== 'all' && String(row.rating) !== tab) return false;
      if (!sameDayOrRange(row.createdAt, filters.from, filters.to)) return false;
      if (page.board === 'posts') {
        if (filters.category && row.categoryId !== filters.category) return false;
        if (filters.user && row.ownerId !== filters.user && row.owner !== filters.user) return false;
        if (filters.location && !String(row.location || '').toLowerCase().includes(filters.location.trim().toLowerCase())) {
          return false;
        }
      }
      if (!query) return true;
      const blob = Object.values(row).join(' ').toLowerCase();
      return blob.includes(query);
    });
  }, [filters, page.board, rows, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const fromRow = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const toRow = Math.min(filtered.length, (safePage + 1) * pageSize);

  const openCreate = () => {
    setFormError('');
    setDraft(emptyDraft(fields));
    setEditor({ mode: 'create' });
    setActionRow(null);
  };

  const openEdit = (row) => {
    setFormError('');
    const next = {};
    for (const field of fields) {
      next[field.key] = row[field.key] == null ? '' : String(row[field.key]);
    }
    setDraft(next);
    setEditor({ mode: 'edit', id: row.id });
    setActionRow(null);
  };

  const save = () => {
    for (const field of fields) {
      if (!field.required) continue;
      if (!String(draft[field.key] || '').trim()) {
        setFormError(`Cần nhập ${field.label.toLowerCase()}.`);
        return;
      }
    }
    const current = rows.find((row) => row.id === editor?.id) || {};
    onCommit(editor?.mode === 'edit' ? 'update' : 'create', {
      ...current,
      ...draft,
      id: editor?.id,
      createdAt: current.createdAt || new Date().toISOString(),
      category: getCategoryById(draft.categoryId)?.name || current.category,
    });
    setEditor(null);
  };

  const tabs = page.board === 'posts' ? POST_TABS : page.board === 'bids' ? BID_TABS : page.board === 'reviews' ? REVIEW_TABS : [];
  const userOptions = [{ value: '', label: 'Tất cả người dùng' }].concat(
    (people || []).map((person) => ({ value: person.id, label: person.name || 'Chưa đặt tên' }))
  );

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {page.board === 'chats' ? <Text style={styles.cardTitle}>Tin nhắn</Text> : <TabRow tabs={tabs} tab={tab} onChange={setTab} />}
        <View style={styles.searchRow}>
          {page.board !== 'chats' ? (
            <TextInput
              style={styles.search}
              placeholder="Tìm kiếm"
              placeholderTextColor={Colors.textLight}
              value={draftFilters.query}
              onChangeText={(query) => setDraftFilters((current) => ({ ...current, query }))}
            />
          ) : null}
          <TextInput
            style={styles.date}
            placeholder="Từ ngày"
            placeholderTextColor={Colors.textLight}
            value={draftFilters.from}
            onChangeText={(from) => setDraftFilters((current) => ({ ...current, from }))}
          />
          <TextInput
            style={styles.date}
            placeholder="Đến ngày"
            placeholderTextColor={Colors.textLight}
            value={draftFilters.to}
            onChangeText={(to) => setDraftFilters((current) => ({ ...current, to }))}
          />
          <Pressable style={styles.iconBtn} onPress={() => setFilters(draftFilters)}>
            <Ionicons name="search" size={16} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={openCreate}>
            <Text style={styles.addText}>Thêm</Text>
          </Pressable>
        </View>
      </View>

      {page.board === 'posts' ? (
        <View style={styles.filterRow}>
          <SelectBox
            value={draftFilters.category}
            placeholder="Tất cả danh mục"
            options={[{ value: '', label: 'Tất cả danh mục' }].concat(
              CATEGORIES.map((item) => ({ value: item.id, label: item.name }))
            )}
            onChange={(category) => setDraftFilters((current) => ({ ...current, category }))}
          />
          <SelectBox
            value={draftFilters.user}
            placeholder="Tất cả người dùng"
            options={userOptions}
            onChange={(user) => setDraftFilters((current) => ({ ...current, user }))}
          />
          <TextInput
            style={styles.location}
            placeholder="Nhập khu vực"
            placeholderTextColor={Colors.textLight}
            value={draftFilters.location}
            onChangeText={(location) => setDraftFilters((current) => ({ ...current, location }))}
          />
          <Pressable style={styles.filterBtn} onPress={() => setFilters(draftFilters)}>
            <Ionicons name="search" size={14} color="#FFFFFF" />
            <Text style={styles.filterText}>Lọc</Text>
          </Pressable>
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              const blank = { query: '', from: '', to: '', category: '', user: '', location: '' };
              setDraftFilters(blank);
              setFilters(blank);
            }}>
            <Ionicons name="close" size={14} color="#FFFFFF" />
            <Text style={styles.filterText}>Xoá lọc</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          <Header board={page.board} />
          {visible.length === 0 ? (
            <Text style={styles.empty}>Chưa có dòng nào. Bấm Thêm để tạo, rồi dùng nút ba chấm để sửa hoặc xoá.</Text>
          ) : (
            visible.map((row, index) => (
              <DataRow
                key={row.id}
                board={page.board}
                row={row}
                index={fromRow + index}
                onAction={() => setActionRow(row)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Hiển thị {fromRow}–{toRow} của {filtered.length} dòng
        </Text>
        <View style={styles.pageSize}>
          <Text style={styles.footerText}>Mỗi trang</Text>
          {PAGE_SIZES.map((size) => (
            <Pressable key={size} style={[styles.sizeBtn, pageSize === size && styles.sizeOn]} onPress={() => setPageSize(size)}>
              <Text style={[styles.sizeText, pageSize === size && styles.sizeTextOn]}>{size}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.pager}>
          <Pressable style={styles.pageBtn} onPress={() => setPageIndex((current) => Math.max(0, current - 1))}>
            <Ionicons name="chevron-back" size={16} color={Colors.primary} />
          </Pressable>
          {Array.from({ length: pageCount }, (_, index) => index)
            .slice(Math.max(0, safePage - 2), Math.max(0, safePage - 2) + 5)
            .map((index) => (
              <Pressable
                key={index}
                style={[styles.pageBtn, index === safePage && styles.pageOn]}
                onPress={() => setPageIndex(index)}>
                <Text style={[styles.pageNum, index === safePage && styles.pageNumOn]}>{index + 1}</Text>
              </Pressable>
            ))}
          <Pressable
            style={styles.pageBtn}
            onPress={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <Modal visible={!!actionRow} transparent animationType="fade" onRequestClose={() => setActionRow(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Thao tác</Text>
            <Pressable style={styles.dialogBtn} onPress={() => openEdit(actionRow)}>
              <Text style={styles.dialogBtnText}>Sửa</Text>
            </Pressable>
            <Pressable
              style={[styles.dialogBtn, styles.dialogDanger]}
              onPress={() => {
                setPendingDelete(actionRow);
                setActionRow(null);
              }}>
              <Text style={styles.dialogDangerText}>Xoá</Text>
            </Pressable>
            <Pressable onPress={() => setActionRow(null)}>
              <Text style={styles.cancel}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialogWide}>
            <Text style={styles.dialogTitle}>{editor?.mode === 'edit' ? 'Sửa' : 'Thêm mới'}</Text>
            <ScrollView style={styles.formScroll}>
              {fields.map((field) => (
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
            <View style={styles.dialogActions}>
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
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Xoá mục này?</Text>
            <Text style={styles.hint}>Mục sẽ biến khỏi danh sách.</Text>
            <View style={styles.dialogActions}>
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

function TabRow({ tabs, tab, onChange }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((item) => {
        const on = tab === item.id;
        return (
          <Pressable key={item.id} style={[styles.tab, on && styles.tabOn]} onPress={() => onChange(item.id)}>
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
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
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
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

function Header({ board }) {
  const labels =
    board === 'posts'
      ? ['#', 'Tiêu đề', 'Người đăng', 'Danh mục', 'Báo giá', 'Ngân sách', 'Trạng thái', 'Người nhận', 'Ngày tạo', '']
      : board === 'bids'
        ? ['#', 'Tin đăng', 'Người báo giá', 'Số tiền', 'Trạng thái', 'Ngày báo giá', '']
        : board === 'reviews'
          ? ['#', 'Tin đăng', 'Người đánh giá', 'Người được đánh giá', 'Số sao', 'Nhận xét', 'Ngày tạo', '']
          : ['#', 'Tin đăng', 'Người đăng', 'Người làm', 'Tin nhắn', 'Tin cuối', ''];
  return (
    <View style={styles.trHead}>
      {labels.map((label, index) => (
        <Text key={`${label}-${index}`} style={[styles.th, cellStyle(board, index)]}>
          {label}
        </Text>
      ))}
    </View>
  );
}

function DataRow({ board, row, index, onAction }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, styles.colIndex]}>{index}</Text>
      {board === 'posts' ? <PostCells row={row} /> : null}
      {board === 'bids' ? <BidCells row={row} /> : null}
      {board === 'reviews' ? <ReviewCells row={row} /> : null}
      {board === 'chats' ? <ChatCells row={row} /> : null}
      <Pressable style={styles.more} onPress={onAction}>
        <Ionicons name="ellipsis-vertical" size={16} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

function PostCells({ row }) {
  const category = getCategoryById(row.categoryId)?.name || row.category || 'Khác';
  return (
    <>
      <Text style={[styles.link, styles.colTitle]} numberOfLines={2}>
        {row.title}
      </Text>
      <Text style={[styles.td, styles.colName]} numberOfLines={1}>
        {row.owner || '—'}
      </Text>
      <View style={styles.colChip}>
        <Text style={styles.chip}>{category}</Text>
      </View>
      <Text style={[styles.soft, styles.colSmall]}>{row.bids || 0} báo giá</Text>
      <Text style={[styles.td, styles.colSmall]}>{formatPrice(row.price)}</Text>
      <View style={styles.colStatus}>
        <StatusPill status={row.status} />
      </View>
      <Text style={[styles.td, styles.colName]} numberOfLines={2}>
        {row.assignee || '—'}
      </Text>
      <Text style={[styles.muted, styles.colDate]}>{formatAdminDate(row.createdAt)}</Text>
    </>
  );
}

function BidCells({ row }) {
  return (
    <>
      <Text style={[styles.link, styles.colTitle]} numberOfLines={2}>
        {row.task}
      </Text>
      <Text style={[styles.td, styles.colName]}>{row.tasker || '—'}</Text>
      <Text style={[styles.td, styles.colSmall]}>{formatPrice(row.price)}</Text>
      <View style={styles.colStatus}>
        <StatusPill status={row.status} />
      </View>
      <Text style={[styles.muted, styles.colDate]}>{formatAdminDate(row.createdAt)}</Text>
    </>
  );
}

function ReviewCells({ row }) {
  const rating = Math.max(0, Math.min(5, Number(row.rating) || 0));
  return (
    <>
      <Text style={[styles.link, styles.colTitle]} numberOfLines={2}>
        {row.task}
      </Text>
      <Text style={[styles.td, styles.colName]}>{row.reviewer || '—'}</Text>
      <Text style={[styles.td, styles.colName]}>{row.reviewee || '—'}</Text>
      <Text style={[styles.stars, styles.colStars]}>
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)} ({rating}/5)
      </Text>
      <Text style={[styles.td, styles.colComment]} numberOfLines={2}>
        {row.comment || '—'}
      </Text>
      <Text style={[styles.muted, styles.colDate]}>{formatAdminDate(row.createdAt)}</Text>
    </>
  );
}

function ChatCells({ row }) {
  const count = Number(row.messageCount) || 0;
  return (
    <>
      <Text style={[styles.link, styles.colTitle]} numberOfLines={2}>
        {row.task}
      </Text>
      <Text style={[styles.td, styles.colName]}>{row.poster || '—'}</Text>
      <Text style={[styles.td, styles.colName]}>{row.tasker || '—'}</Text>
      <View style={styles.colChip}>
        <Text style={styles.countPill}>
          {count} tin nhắn
        </Text>
      </View>
      <Text style={[styles.td, styles.colComment]} numberOfLines={2}>
        {row.lastMessage || '—'}
      </Text>
    </>
  );
}

function StatusPill({ status }) {
  const look = STATUS_LOOK[status] || { label: status || '—', color: Colors.textMuted, bg: '#F2F4F7' };
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]}>
      <Text style={[styles.pillText, { color: look.color }]}>{look.label}</Text>
    </View>
  );
}

function cellStyle(board, index) {
  if (index === 0) return styles.colIndex;
  if (board === 'posts') {
    return [styles.colTitle, styles.colName, styles.colChip, styles.colSmall, styles.colSmall, styles.colStatus, styles.colName, styles.colDate, styles.colAction][
      index - 1
    ];
  }
  if (board === 'bids') {
    return [styles.colTitle, styles.colName, styles.colSmall, styles.colStatus, styles.colDate, styles.colAction][index - 1];
  }
  if (board === 'reviews') {
    return [styles.colTitle, styles.colName, styles.colName, styles.colStars, styles.colComment, styles.colDate, styles.colAction][
      index - 1
    ];
  }
  return [styles.colTitle, styles.colName, styles.colName, styles.colChip, styles.colComment, styles.colAction][index - 1];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  tabOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: '#FFFFFF' },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  search: {
    minWidth: 180,
    flexGrow: 1,
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
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: '#FFFFFF', fontWeight: '800' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', zIndex: 5 },
  location: {
    minWidth: 180,
    flexGrow: 1,
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
  table: { minWidth: 980 },
  trHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primarySoft, borderRadius: 8, paddingVertical: 10 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  th: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  td: { color: Colors.text, fontSize: 13 },
  link: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  muted: { color: Colors.textMuted, fontSize: 12 },
  soft: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  colIndex: { width: 36, paddingHorizontal: 8 },
  colTitle: { width: 180, paddingRight: 8 },
  colName: { width: 130, paddingRight: 8 },
  colChip: { width: 120, paddingRight: 8 },
  colSmall: { width: 100, paddingRight: 8 },
  colStatus: { width: 110, paddingRight: 8 },
  colDate: { width: 100, paddingRight: 8 },
  colStars: { width: 150, paddingRight: 8 },
  colComment: { width: 180, paddingRight: 8 },
  colAction: { width: 36 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stars: { color: '#F5A524', fontWeight: '700', fontSize: 12 },
  pill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontWeight: '800', fontSize: 12 },
  more: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  empty: { color: Colors.textMuted, padding: 16 },
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
  pageNum: { color: Colors.primary, fontWeight: '800' },
  pageNumOn: { color: '#FFFFFF' },
  selectWrap: { width: 200, zIndex: 4 },
  select: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectText: { flex: 1, color: Colors.text, fontSize: 13 },
  selectMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    zIndex: 6,
    elevation: 6,
  },
  selectItem: { paddingHorizontal: 10, paddingVertical: 8 },
  selectItemText: { color: Colors.text, fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 8 },
  dialogWide: { width: '100%', maxWidth: 520, maxHeight: '86%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  dialogBtn: { backgroundColor: Colors.primarySoft, borderRadius: 10, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  dialogBtnText: { color: Colors.primary, fontWeight: '800' },
  dialogDanger: { backgroundColor: '#FEF3F2' },
  dialogDangerText: { color: '#B42318', fontWeight: '800' },
  cancel: { textAlign: 'center', color: Colors.textMuted, fontWeight: '700', paddingVertical: 6 },
  hint: { color: Colors.textMuted, lineHeight: 20 },
  formScroll: { flexGrow: 0, marginTop: 8 },
  field: { marginBottom: 10 },
  fieldLabel: { fontWeight: '700', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F2F4F7' },
  choiceOn: { backgroundColor: Colors.primarySoft },
  choiceText: { color: Colors.text, fontWeight: '700' },
  choiceTextOn: { color: Colors.primary },
  error: { color: '#B42318', marginTop: 4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  ghost: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontWeight: '800', color: Colors.text },
  save: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
  deleteSolid: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center' },
});
