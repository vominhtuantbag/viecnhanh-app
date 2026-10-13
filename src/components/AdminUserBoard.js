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
import { formatPrice } from '@/data/jobs';

const PAGE_SIZES = [15, 30, 50];
const AVATAR_COLORS = ['#0052FF', '#7A5AF8', '#12B76A', '#F79009', '#EE46BC', '#0BA5EC'];

const USER_FILTERS = [
  { value: 'all', label: 'Tất cả người dùng' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'banned', label: 'Đã khoá' },
  { value: 'admin', label: 'Quản trị' },
];

const VERIFY_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác minh' },
  { id: 'done', label: 'Đã xác minh' },
];

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'ND';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarColor(id) {
  const text = String(id || '');
  const total = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function formatJoined(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()} ${hour}:${minute}`;
}

function relativeVi(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diff < hour) return 'Vừa xong';
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} giờ trước`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} ngày trước`;
  if (diff < 30 * day) return `${Math.max(1, Math.floor(diff / (7 * day)))} tuần trước`;
  if (diff < 365 * day) return `${Math.max(1, Math.floor(diff / (30 * day)))} tháng trước`;
  return `${Math.floor(diff / (365 * day))} năm trước`;
}

function parseFilterDate(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function inRange(createdAt, fromText, toText) {
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

function handleFrom(name, phone) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  if (base) return `@${base}`;
  const tail = String(phone || '').replace(/\D/g, '').slice(-4);
  return tail ? `@user${tail}` : '@thanhvien';
}

export default function AdminUserBoard({ page, rows, onCommit }) {
  const [filter, setFilter] = useState('all');
  const [verifyTab, setVerifyTab] = useState('all');
  const [draft, setDraft] = useState({ query: '', from: '', to: '' });
  const [applied, setApplied] = useState(draft);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [menuRow, setMenuRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [credit, setCredit] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [pendingBan, setPendingBan] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', wallet: '0', password: '', passwordAgain: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNote, setFormNote] = useState('');

  useEffect(() => {
    setPageIndex(0);
  }, [filter, verifyTab, applied, pageSize, page.id]);

  const filtered = useMemo(() => {
    const query = applied.query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!inRange(row.createdAt, applied.from, applied.to)) return false;
      if (page.board === 'users') {
        if (filter === 'active' && row.status === 'banned') return false;
        if (filter === 'banned' && row.status !== 'banned') return false;
        if (filter === 'admin' && row.role !== 'admin') return false;
      }
      if (page.board === 'verify') {
        if (verifyTab === 'pending' && row.verified) return false;
        if (verifyTab === 'done' && !row.verified) return false;
      }
      if (!query) return true;
      return [row.name, row.handle, row.phone, row.email].join(' ').toLowerCase().includes(query);
    });
  }, [applied, filter, page.board, rows, verifyTab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const fromRow = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const toRow = Math.min(filtered.length, (safePage + 1) * pageSize);

  if (page.board === 'create') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thêm người dùng</Text>
        <Text style={styles.hint}>Điền hồ sơ và mật khẩu. Người này đăng nhập được và hiện trong mục Người dùng.</Text>
        <Field label="Họ tên" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
        <Field label="Số điện thoại" value={form.phone} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} />
        <Field label="Email" value={form.email} onChangeText={(email) => setForm((current) => ({ ...current, email }))} />
        <Field
          label="Mật khẩu"
          value={form.password}
          secureTextEntry
          onChangeText={(password) => setForm((current) => ({ ...current, password }))}
        />
        <Field
          label="Nhập lại mật khẩu"
          value={form.passwordAgain}
          secureTextEntry
          onChangeText={(passwordAgain) => setForm((current) => ({ ...current, passwordAgain }))}
        />
        <Field
          label="Số dư ví ban đầu"
          value={form.wallet}
          keyboardType="numeric"
          onChangeText={(wallet) => setForm((current) => ({ ...current, wallet }))}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        {formNote ? <Text style={styles.note}>{formNote}</Text> : null}
        <Pressable
          style={styles.primaryBtn}
          disabled={saving}
          onPress={async () => {
            if (!form.name.trim() || !form.phone.trim()) {
              setFormError('Cần nhập họ tên và số điện thoại.');
              setFormNote('');
              return;
            }
            if (form.password.length < 6) {
              setFormError('Mật khẩu cần ít nhất 6 ký tự.');
              setFormNote('');
              return;
            }
            if (form.password !== form.passwordAgain) {
              setFormError('Mật khẩu nhập lại chưa khớp.');
              setFormNote('');
              return;
            }
            setFormError('');
            setFormNote('');
            setSaving(true);
            try {
              await onCommit('create', {
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                wallet: form.wallet || '0',
                password: form.password,
              });
              setForm({ name: '', phone: '', email: '', wallet: '0', password: '', passwordAgain: '' });
              setFormNote('Đã tạo tài khoản. Mở mục Người dùng để xem lại danh sách.');
            } catch (err) {
              setFormError(err.message || 'Không tạo được tài khoản.');
            } finally {
              setSaving(false);
            }
          }}>
          <Text style={styles.primaryText}>{saving ? 'Đang tạo...' : 'Tạo người dùng'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {page.board === 'verify' ? (
          <View style={styles.tabs}>
            {VERIFY_TABS.map((item) => {
              const on = verifyTab === item.id;
              return (
                <Pressable key={item.id} style={[styles.tab, on && styles.tabOn]} onPress={() => setVerifyTab(item.id)}>
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <FilterSelect value={filter} options={USER_FILTERS} onChange={setFilter} />
        )}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Tìm kiếm"
            placeholderTextColor={Colors.textLight}
            value={draft.query}
            onChangeText={(query) => setDraft((current) => ({ ...current, query }))}
          />
          <Text style={styles.dateLabel}>Khoảng ngày</Text>
          <TextInput
            style={styles.date}
            placeholder="Từ ngày"
            placeholderTextColor={Colors.textLight}
            value={draft.from}
            onChangeText={(from) => setDraft((current) => ({ ...current, from }))}
          />
          <TextInput
            style={styles.date}
            placeholder="Đến ngày"
            placeholderTextColor={Colors.textLight}
            value={draft.to}
            onChangeText={(to) => setDraft((current) => ({ ...current, to }))}
          />
          <Pressable style={styles.iconBtn} onPress={() => setApplied(draft)}>
            <Ionicons name="search" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          <View style={styles.head}>
            {(page.board === 'verify'
              ? ['Tên', 'Số điện thoại', 'Email', 'Xác minh', 'Ngày tham gia', '']
              : ['Tên', 'Số điện thoại', 'Email', 'Ví', 'Ngày tham gia', 'Trạng thái', '']
            ).map((label) => (
              <Text key={label || 'action'} style={[styles.th, columnStyle(page.board, label)]}>
                {label}
              </Text>
            ))}
          </View>
          {visible.length === 0 ? (
            <Text style={styles.empty}>Chưa có người dùng trong bộ lọc này.</Text>
          ) : (
            visible.map((row) => (
              <View key={row.id} style={styles.tr}>
                <View style={[styles.nameCell, styles.colName]}>
                  <View style={[styles.avatar, { backgroundColor: avatarColor(row.id) }]}>
                    <Text style={styles.avatarText}>{initials(row.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={styles.handle} numberOfLines={1}>
                      {row.handle}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.td, styles.colPhone]} numberOfLines={1}>
                  {row.phone || '—'}
                </Text>
                <Text style={[styles.td, styles.colEmail]} numberOfLines={1}>
                  {row.email || '—'}
                </Text>
                {page.board === 'verify' ? (
                  <View style={styles.colStatus}>
                    <Text style={[styles.pill, row.verified ? styles.pillOn : styles.pillWait]}>
                      {row.verified ? 'Đã xác minh' : 'Chờ xác minh'}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.td, styles.colWallet]}>{formatPrice(row.wallet)}</Text>
                )}
                <View style={styles.colDate}>
                  <Text style={styles.td}>{formatJoined(row.createdAt)}</Text>
                  <Text style={styles.ago}>{relativeVi(row.createdAt)}</Text>
                </View>
                {page.board === 'users' ? (
                  <View style={styles.colStatus}>
                    <Text style={[styles.pill, row.status === 'banned' ? styles.pillOff : styles.pillOn]}>
                      {row.status === 'banned' ? 'Đã khoá' : 'Đang hoạt động'}
                    </Text>
                  </View>
                ) : null}
                <Pressable style={styles.more} onPress={() => setMenuRow(row)}>
                  <Ionicons name="ellipsis-vertical" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
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
          <Pressable style={[styles.pageBtn, styles.pageOn]}>
            <Text style={styles.pageNumOn}>{safePage + 1}</Text>
          </Pressable>
          <Pressable style={styles.pageBtn} onPress={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <Modal visible={!!menuRow} transparent animationType="fade" onRequestClose={() => setMenuRow(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuRow(null)} />
          <View style={styles.menuCard}>
            {page.board === 'verify' ? (
              <MenuItem
                icon={menuRow?.verified ? 'close-circle-outline' : 'checkmark-circle-outline'}
                label={menuRow?.verified ? 'Gỡ xác minh' : 'Duyệt xác minh'}
                onPress={() => {
                  onCommit('verify', { ...menuRow, verified: !menuRow.verified });
                  setMenuRow(null);
                }}
              />
            ) : (
              <>
                <MenuItem
                  icon="eye-outline"
                  label="Chi tiết"
                  onPress={() => {
                    setDetail(menuRow);
                    setMenuRow(null);
                  }}
                />
                <MenuItem
                  icon="shield-checkmark-outline"
                  label="Cộng tiền"
                  onPress={() => {
                    setCredit(menuRow);
                    setCreditAmount('');
                    setMenuRow(null);
                  }}
                />
                <MenuItem
                  icon="ban-outline"
                  label={menuRow?.status === 'banned' ? 'Mở khoá' : 'Khoá tài khoản'}
                  danger={menuRow?.status !== 'banned'}
                  onPress={() => {
                    setPendingBan(menuRow);
                    setMenuRow(null);
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{detail?.name}</Text>
            <Text style={styles.handle}>{detail?.handle}</Text>
            <Info label="Số điện thoại" value={detail?.phone || '—'} />
            <Info label="Email" value={detail?.email || '—'} />
            <Info label="Số dư ví" value={formatPrice(detail?.wallet)} />
            <Info label="Ngày tham gia" value={formatJoined(detail?.createdAt)} />
            <Info label="Xác minh" value={detail?.verified ? 'Đã xác minh' : 'Chưa xác minh'} />
            <Info label="Trạng thái" value={detail?.status === 'banned' ? 'Đã khoá' : 'Đang hoạt động'} />
            <View style={styles.dialogActions}>
              <Pressable style={styles.ghost} onPress={() => setDetail(null)}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  setEditing({ ...detail });
                  setDetail(null);
                }}>
                <Text style={styles.primaryText}>Sửa</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Sửa người dùng</Text>
            <Field label="Họ tên" value={editing?.name || ''} onChangeText={(name) => setEditing((current) => ({ ...current, name }))} />
            <Field label="Số điện thoại" value={editing?.phone || ''} onChangeText={(phone) => setEditing((current) => ({ ...current, phone }))} />
            <Field label="Email" value={editing?.email || ''} onChangeText={(email) => setEditing((current) => ({ ...current, email }))} />
            <View style={styles.dialogActions}>
              <Pressable style={styles.ghost} onPress={() => setEditing(null)}>
                <Text style={styles.ghostText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={styles.dangerBtn}
                onPress={() => {
                  onCommit('delete', editing);
                  setEditing(null);
                }}>
                <Text style={styles.primaryText}>Xoá</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  onCommit('update', { ...editing, handle: handleFrom(editing.name, editing.phone) });
                  setEditing(null);
                }}>
                <Text style={styles.primaryText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!credit} transparent animationType="fade" onRequestClose={() => setCredit(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Cộng tiền</Text>
            <Text style={styles.hint}>
              {credit?.name} đang có {formatPrice(credit?.wallet)}. Nhập số tiền muốn cộng thêm.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Số tiền"
              keyboardType="numeric"
              value={creditAmount}
              onChangeText={setCreditAmount}
            />
            <View style={styles.dialogActions}>
              <Pressable style={styles.ghost} onPress={() => setCredit(null)}>
                <Text style={styles.ghostText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  const amount = Number(creditAmount);
                  if (!amount || amount <= 0) return;
                  onCommit('credit', { ...credit, wallet: String((Number(credit.wallet) || 0) + amount) });
                  setCredit(null);
                }}>
                <Text style={styles.primaryText}>Cộng</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingBan} transparent animationType="fade" onRequestClose={() => setPendingBan(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{pendingBan?.status === 'banned' ? 'Mở khoá tài khoản?' : 'Khoá tài khoản?'}</Text>
            <Text style={styles.hint}>{pendingBan?.name}</Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.ghost} onPress={() => setPendingBan(null)}>
                <Text style={styles.ghostText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={pendingBan?.status === 'banned' ? styles.primaryBtn : styles.dangerBtn}
                onPress={() => {
                  onCommit('ban', {
                    ...pendingBan,
                    status: pendingBan.status === 'banned' ? 'active' : 'banned',
                  });
                  setPendingBan(null);
                }}>
                <Text style={styles.primaryText}>{pendingBan?.status === 'banned' ? 'Mở khoá' : 'Khoá'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function columnStyle(board, label) {
  if (label === 'Tên') return styles.colName;
  if (label === 'Số điện thoại') return styles.colPhone;
  if (label === 'Email') return styles.colEmail;
  if (label === 'Ví' || label === 'Xác minh') return board === 'verify' ? styles.colStatus : styles.colWallet;
  if (label === 'Ngày tham gia') return styles.colDate;
  if (label === 'Trạng thái') return styles.colStatus;
  return styles.colAction;
}

function FilterSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const label = options.find((item) => item.value === value)?.label || options[0].label;
  return (
    <View style={styles.selectWrap}>
      <Pressable style={styles.select} onPress={() => setOpen((current) => !current)}>
        <Text style={styles.selectText}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.selectMenu}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              style={styles.selectItem}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}>
              <Text style={styles.selectItemText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger }) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? '#B42318' : Colors.text} />
      <Text style={[styles.menuLabel, danger && styles.menuDanger]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, keyboardType, secureTextEntry }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.td}>{value}</Text>
    </View>
  );
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
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  hint: { color: Colors.textMuted, lineHeight: 20 },
  note: { color: Colors.primary, fontWeight: '700' },
  error: { color: '#B42318' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center', zIndex: 5 },
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
    minWidth: 160,
    flexGrow: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
  },
  dateLabel: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },
  date: {
    width: 110,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  table: { minWidth: 980 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    paddingVertical: 10,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  th: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  td: { color: Colors.text, fontSize: 13 },
  colName: { width: 220, paddingHorizontal: 8 },
  colPhone: { width: 140, paddingRight: 8 },
  colEmail: { width: 180, paddingRight: 8 },
  colWallet: { width: 120, paddingRight: 8 },
  colDate: { width: 150, paddingRight: 8 },
  colStatus: { width: 130, paddingRight: 8 },
  colAction: { width: 40 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  name: { fontWeight: '800', color: Colors.text },
  handle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  ago: { color: Colors.textLight, fontSize: 12, marginTop: 2 },
  pill: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '800', fontSize: 12 },
  pillOn: { backgroundColor: Colors.successSoft, color: Colors.success },
  pillOff: { backgroundColor: '#FEF3F2', color: '#B42318' },
  pillWait: { backgroundColor: '#FFFAEB', color: '#B54708' },
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
  },
  pageOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pageNumOn: { color: '#FFFFFF', fontWeight: '800' },
  selectWrap: { width: 190, zIndex: 6 },
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
  },
  selectText: { color: Colors.text, fontWeight: '700' },
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
  selectItem: { paddingHorizontal: 12, paddingVertical: 10 },
  selectItemText: { color: Colors.text },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  menuCard: { width: '100%', maxWidth: 280, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 6, zIndex: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  menuLabel: { color: Colors.text, fontWeight: '700' },
  menuDanger: { color: '#B42318' },
  dialog: { width: '100%', maxWidth: 460, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 8 },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  field: { gap: 6 },
  fieldLabel: { fontWeight: '700', color: Colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  ghost: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontWeight: '800', color: Colors.text },
  primaryBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
});
