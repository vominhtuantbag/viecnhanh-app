import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { displayPhone } from '@/lib/phone';
import {
  deleteAdminNotification,
  fetchAdminNotifications,
  saveAdminNotification,
  searchProfilesForNotification,
  uploadNotificationImage,
} from '@/services/adminNotifications';

const WEEKDAYS = [
  { id: 1, label: 'Thứ 2' },
  { id: 2, label: 'Thứ 3' },
  { id: 3, label: 'Thứ 4' },
  { id: 4, label: 'Thứ 5' },
  { id: 5, label: 'Thứ 6' },
  { id: 6, label: 'Thứ 7' },
  { id: 7, label: 'Chủ nhật' },
];

const RECURRENCE = [
  { id: 'none', label: 'Không lặp lại', hint: 'Gửi một lần rồi dừng.' },
  { id: 'daily', label: 'Hàng ngày', hint: 'Mỗi ngày, đúng giờ đã chọn.' },
  { id: 'weekly', label: 'Hàng tuần', hint: 'Mỗi tuần vào thứ đã chọn.' },
  { id: 'monthly', label: 'Hàng tháng', hint: 'Mỗi tháng vào ngày đã chọn. Tháng không có ngày đó sẽ gửi vào ngày cuối tháng.' },
  { id: 'yearly', label: 'Hàng năm', hint: 'Mỗi năm vào đúng ngày và giờ của lần gửi đầu.' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ gửi' },
  { id: 'scheduled', label: 'Đã hẹn' },
  { id: 'sent', label: 'Đã gửi' },
];

const STATUS_LOOK = {
  pending: { label: 'Chờ gửi', color: '#B54708', bg: '#FFFAEB' },
  scheduled: { label: 'Đã hẹn', color: '#175CD3', bg: '#EFF8FF' },
  sent: { label: 'Đã gửi', color: '#027A48', bg: '#ECFDF3' },
  error: { label: 'Lỗi', color: '#B42318', bg: '#FEF3F2' },
};

function vnParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const day = get('day');
  return {
    date: `${get('year')}-${get('month')}-${day}`,
    time: `${hour}:${get('minute')}`,
    weekday: weekdayMap[get('weekday')] || 1,
    monthDay: Number(day) || 1,
  };
}

function blankForm() {
  const now = vnParts();
  return {
    id: null,
    audience: 'all',
    targets: [],
    title: '',
    body: '',
    imageUrl: '',
    actionUrl: '',
    sendMode: 'now',
    date: now.date,
    time: now.time,
    recurrence: 'none',
    weekday: now.weekday,
    monthDay: String(now.monthDay),
  };
}

function formFromRow(row) {
  const nextTime = row.next_run_at ? new Date(row.next_run_at).getTime() : 0;
  const upcoming = nextTime > Date.now() + 15000;
  const when = vnParts(new Date(upcoming ? row.next_run_at : row.scheduled_at || Date.now()));
  return {
    id: row.id,
    audience: row.audience === 'users' ? 'users' : 'all',
    targets: Array.isArray(row.targets)
      ? row.targets
          .filter((item) => item?.id)
          .map((item) => ({
            id: item.id,
            name: item.name || 'Người dùng',
            phone: item.phone || '',
          }))
      : [],
    title: row.title || '',
    body: row.body || '',
    imageUrl: row.image_url || '',
    actionUrl: row.action_url || '',
    sendMode: upcoming ? 'schedule' : 'now',
    date: when.date,
    time: when.time,
    recurrence: row.recurrence || 'none',
    weekday: row.weekday || when.weekday,
    monthDay: String(row.month_day || when.monthDay),
  };
}

function formatWhen(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function recurrenceText(row) {
  if (row.recurrence === 'daily') return 'Hàng ngày';
  if (row.recurrence === 'weekly') {
    const day = WEEKDAYS.find((item) => item.id === row.weekday);
    return day ? `Hàng tuần · ${day.label}` : 'Hàng tuần';
  }
  if (row.recurrence === 'monthly') return `Hàng tháng · ngày ${row.month_day || '?'}`;
  if (row.recurrence === 'yearly') return 'Hàng năm';
  return 'Một lần';
}

function validate(form) {
  if (!form.title.trim()) return 'Nhập tiêu đề thông báo.';
  if (form.title.trim().length > 120) return 'Tiêu đề tối đa 120 ký tự.';
  if (!form.body.trim()) return 'Nhập nội dung thông báo.';
  if (form.body.trim().length > 500) return 'Nội dung tối đa 500 ký tự.';
  if (form.audience === 'users' && form.targets.length === 0) return 'Chọn ít nhất một người nhận.';
  if (form.audience === 'users' && form.targets.length > 50) {
    return 'Chỉ chọn tối đa 50 người. Muốn gửi rộng hơn, hãy chọn Gửi tất cả.';
  }
  if (form.imageUrl.trim() && !/^https:\/\//i.test(form.imageUrl.trim())) {
    return 'Ảnh cần là đường dẫn bắt đầu bằng https://';
  }
  if (form.actionUrl.trim() && !/^(\/|https:\/\/)/i.test(form.actionUrl.trim())) {
    return 'Link cần bắt đầu bằng / (trong app) hoặc https://';
  }
  if (form.sendMode === 'schedule') {
    if (!form.date || !form.time) return 'Chọn ngày và giờ gửi.';
    const when = new Date(`${form.date}T${form.time}:00+07:00`);
    if (Number.isNaN(when.getTime())) return 'Ngày hoặc giờ không hợp lệ.';
    if (when.getTime() <= Date.now()) return 'Giờ hẹn phải ở tương lai.';
  }
  if (form.recurrence === 'weekly' && !(form.weekday >= 1 && form.weekday <= 7)) {
    return 'Chọn thứ trong tuần để lặp lại.';
  }
  if (form.recurrence === 'monthly') {
    const day = Number(form.monthDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) return 'Ngày trong tháng phải từ 1 đến 31.';
  }
  return '';
}

function toPayload(form) {
  return {
    id: form.id || null,
    title: form.title.trim(),
    body: form.body.trim(),
    image_url: form.imageUrl.trim(),
    action_url: form.actionUrl.trim(),
    audience: form.audience,
    targets: form.audience === 'users' ? form.targets : [],
    send_mode: form.sendMode,
    scheduled_at: form.sendMode === 'schedule' ? new Date(`${form.date}T${form.time}:00+07:00`).toISOString() : null,
    recurrence: form.recurrence,
    weekday: form.recurrence === 'weekly' ? form.weekday : null,
    month_day: form.recurrence === 'monthly' ? Number(form.monthDay) : null,
  };
}

function resultMessage(row) {
  if (row?.last_error) return `Đã lưu. ${row.last_error}`;
  if (row?.status === 'sent') return 'Đã gửi tới những người đang bật thông báo khuyến mãi.';
  if (row?.status === 'scheduled') return `Đã hẹn gửi lúc ${formatWhen(row.next_run_at || row.scheduled_at)}.`;
  return 'Đã lưu chiến dịch.';
}

function WebClock({ date, time, onDate, onTime }) {
  if (Platform.OS === 'web') {
    const style = {
      height: 44,
      border: '1px solid #EAECF0',
      borderRadius: 12,
      padding: '0 12px',
      fontSize: 14,
      background: '#FFFFFF',
      color: '#101828',
      flex: 1,
      minWidth: 140,
    };
    return (
      <View style={styles.clockRow}>
        {createElement('input', {
          type: 'date',
          value: date,
          onChange: (event) => onDate(event.target.value),
          style,
        })}
        {createElement('input', {
          type: 'time',
          value: time,
          onChange: (event) => onTime(event.target.value),
          style,
        })}
      </View>
    );
  }

  return (
    <View style={styles.clockRow}>
      <TextInput
        style={[styles.input, styles.clockInput]}
        value={date}
        onChangeText={onDate}
        placeholder="2026-10-14"
        placeholderTextColor={Colors.textLight}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, styles.clockInput]}
        value={time}
        onChangeText={onTime}
        placeholder="09:30"
        placeholderTextColor={Colors.textLight}
        autoCapitalize="none"
      />
    </View>
  );
}

function PhonePreview({ title, body, imageUrl, imageOk, onImageError }) {
  return (
    <View style={styles.phone}>
      <View style={styles.phoneSpeaker} />
      <Text style={styles.phoneClock}>9:41</Text>
      <View style={styles.note}>
        <View style={styles.noteTop}>
          <View style={styles.noteIcon}>
            <Ionicons name="briefcase" size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.noteApp}>VIỆC NHANH</Text>
          <Text style={styles.noteTime}>bây giờ</Text>
        </View>
        <Text style={styles.noteTitle} numberOfLines={2}>
          {title.trim() || 'Tiêu đề thông báo'}
        </Text>
        <Text style={styles.noteBody} numberOfLines={4}>
          {body.trim() || 'Nội dung sẽ hiện ở đây khi bạn nhập.'}
        </Text>
        {imageUrl.trim() && imageOk ? (
          <Image
            source={{ uri: imageUrl.trim() }}
            style={styles.noteImage}
            contentFit="cover"
            onError={onImageError}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function AdminNotificationBoard({ people = [], compact = false }) {
  const scrollRef = useRef(null);
  const [form, setForm] = useState(blankForm);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState('ok');
  const [userQuery, setUserQuery] = useState('');
  const [remoteHits, setRemoteHits] = useState([]);
  const [remoteQuery, setRemoteQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableQuery, setTableQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [brokenImage, setBrokenImage] = useState('');

  const applyList = useCallback((result) => {
    setRows(result.rows);
    setListError(result.processError || '');
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    try {
      applyList(await fetchAdminNotifications());
    } catch (err) {
      setListError(err.message || 'Không tải được danh sách thông báo.');
      setLoading(false);
    }
  }, [applyList]);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      fetchAdminNotifications()
        .then((result) => {
          if (!cancelled) applyList(result);
        })
        .catch((err) => {
          if (!cancelled) {
            setListError(err.message || 'Không tải được danh sách thông báo.');
            setLoading(false);
          }
        });
    };
    const timer = setTimeout(pull, 0);
    const interval = setInterval(pull, 60000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [applyList]);

  useEffect(() => {
    const query = userQuery.trim();
    if (form.audience !== 'users' || query.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchProfilesForNotification(query)
        .then((list) => {
          if (cancelled) return;
          setRemoteHits(list);
          setRemoteQuery(query);
        })
        .catch(() => {
          if (cancelled) return;
          setRemoteHits([]);
          setRemoteQuery(query);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.audience, userQuery]);

  const hits = useMemo(() => {
    const typed = userQuery.trim();
    const query = typed.toLowerCase();
    if (!query) return [];
    const local = people
      .filter((person) => {
        const blob = `${person.name || ''} ${person.phone || ''} ${person.email || ''} ${person.id || ''}`.toLowerCase();
        return blob.includes(query);
      })
      .slice(0, 8);
    const remote = remoteQuery === typed ? remoteHits : [];
    const map = new Map();
    for (const person of [...local, ...remote]) {
      if (!person?.id) continue;
      if (form.targets.some((item) => item.id === person.id)) continue;
      map.set(person.id, {
        id: person.id,
        name: person.name || 'Chưa đặt tên',
        phone: person.phone || '',
      });
    }
    return [...map.values()].slice(0, 8);
  }, [form.targets, people, remoteHits, remoteQuery, userQuery]);

  const visibleRows = useMemo(() => {
    const query = tableQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!query) return true;
      return `${row.title || ''} ${row.body || ''} ${row.target_label || ''}`.toLowerCase().includes(query);
    });
  }, [rows, statusFilter, tableQuery]);

  const recurrence = RECURRENCE.find((item) => item.id === form.recurrence) || RECURRENCE[0];
  const pastedId = userQuery.trim();
  const pastedIsId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pastedId);

  const patch = (next) => setForm((current) => ({ ...current, ...next }));

  const addTarget = (person) => {
    if (form.targets.length >= 50) {
      setFormError('Chỉ chọn tối đa 50 người. Muốn gửi rộng hơn, hãy chọn Gửi tất cả.');
      return;
    }
    setForm((current) => {
      if (current.targets.some((item) => item.id === person.id) || current.targets.length >= 50) return current;
      return { ...current, targets: [...current.targets, person] };
    });
    setUserQuery('');
    setRemoteHits([]);
    setFormError('');
  };

  const onPickImage = () => {
    const doc = globalThis.document;
    if (Platform.OS !== 'web' || !doc) {
      setFormError('Trên điện thoại hãy dán đường dẫn ảnh bắt đầu bằng https://. Trên máy tính, dùng nút Chọn ảnh.');
      return;
    }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Ảnh cần nhỏ hơn 5 MB.');
        return;
      }
      setUploading(true);
      setFormError('');
      try {
        const url = await uploadNotificationImage(file);
        patch({ imageUrl: url });
      } catch (err) {
        setFormError(err.message || 'Không tải được ảnh.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const onSubmit = async () => {
    const message = validate(form);
    if (message) {
      setFormError(message);
      return;
    }
    setBusy(true);
    setFormError('');
    setNotice('');
    try {
      const saved = await saveAdminNotification(toPayload(form));
      setNotice(resultMessage(saved));
      setNoticeTone(saved?.last_error ? 'warn' : 'ok');
      setForm(blankForm());
      setUserQuery('');
      await load();
    } catch (err) {
      setFormError(err.message || 'Không lưu được chiến dịch.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteAdminNotification(pendingDelete.id);
      if (form.id === pendingDelete.id) setForm(blankForm());
      setPendingDelete(null);
      setNotice('Đã xóa chiến dịch.');
      setNoticeTone('ok');
      await load();
    } catch (err) {
      setListError(err.message || 'Không xóa được.');
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (row) => {
    setForm(formFromRow(row));
    setFormError('');
    setNotice('');
    setUserQuery('');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Gửi thông báo</Text>
      <Text style={styles.subtitle}>
        Soạn tin đẩy tới điện thoại người dùng: gửi ngay, hẹn giờ, hoặc lặp lại để nhắc khuyến mãi và giữ chân.
      </Text>

      {notice ? (
        <View style={[styles.banner, noticeTone === 'warn' ? styles.bannerWarn : styles.bannerOk]}>
          <Text style={[styles.bannerText, noticeTone === 'warn' ? styles.bannerTextWarn : styles.bannerTextOk]}>
            {notice}
          </Text>
        </View>
      ) : null}

      <View style={[styles.composer, compact && styles.composerStack]}>
        <View style={styles.card}>
          {form.id ? (
            <View style={styles.editBar}>
              <Text style={styles.editText}>Đang sửa chiến dịch</Text>
              <Pressable onPress={() => { setForm(blankForm()); setFormError(''); }}>
                <Text style={styles.link}>Hủy sửa</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.label}>Chọn đối tượng nhận</Text>
          <View style={styles.choiceRow}>
            {[
              { id: 'all', label: 'Gửi tất cả', icon: 'megaphone-outline' },
              { id: 'users', label: 'Nhập tên/ID người dùng', icon: 'person-outline' },
            ].map((item) => {
              const on = form.audience === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.choice, on && styles.choiceOn]}
                  onPress={() => patch({ audience: item.id })}>
                  <Ionicons name={item.icon} size={16} color={on ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Chỉ người đang bật thông báo khuyến mãi mới nhận được tin này.</Text>

          {form.audience === 'users' ? (
            <View style={styles.block}>
              <TextInput
                style={styles.input}
                value={userQuery}
                onChangeText={setUserQuery}
                placeholder="Gõ tên, số điện thoại hoặc dán ID"
                placeholderTextColor={Colors.textLight}
                autoCapitalize="none"
              />
              {form.targets.length ? (
                <View style={styles.chips}>
                  {form.targets.map((person) => (
                    <Pressable
                      key={person.id}
                      style={styles.chip}
                      onPress={() => patch({ targets: form.targets.filter((item) => item.id !== person.id) })}>
                      <Text style={styles.chipText}>
                        {person.name}
                        {person.phone ? ` · ${displayPhone(person.phone)}` : ''}
                      </Text>
                      <Ionicons name="close" size={14} color={Colors.primary} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.hint}>Chưa chọn ai. Bấm một dòng bên dưới để thêm.</Text>
              )}
              {hits.map((person) => (
                <Pressable key={person.id} style={styles.hit} onPress={() => addTarget(person)}>
                  <Text style={styles.hitName}>{person.name}</Text>
                  <Text style={styles.hitMeta}>{person.phone ? displayPhone(person.phone) : person.id}</Text>
                </Pressable>
              ))}
              {pastedIsId && !form.targets.some((item) => item.id === pastedId) ? (
                <Pressable style={styles.hit} onPress={() => addTarget({ id: pastedId, name: 'Theo ID', phone: '' })}>
                  <Text style={styles.hitName}>Thêm đúng ID này</Text>
                  <Text style={styles.hitMeta}>{pastedId}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.label}>Tiêu đề thông báo</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(title) => patch({ title })}
            placeholder="🔥 Săn việc nhanh, nhận quà khủng cuối tuần!"
            placeholderTextColor={Colors.textLight}
            maxLength={120}
          />
          <Text style={styles.counter}>{form.title.trim().length}/120</Text>

          <Text style={styles.label}>Nội dung thông báo</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={form.body}
            onChangeText={(body) => patch({ body })}
            placeholder="Mở app, hoàn thành nhiệm vụ cuối tuần và đổi quà ngay trong ví."
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={500}
          />
          <Text style={styles.counter}>{form.body.trim().length}/500</Text>

          <Text style={styles.label}>Hình ảnh đính kèm</Text>
          <View style={styles.inline}>
            <TextInput
              style={[styles.input, styles.flexInput]}
              value={form.imageUrl}
              onChangeText={(imageUrl) => patch({ imageUrl })}
              placeholder="https://.../banner.jpg"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="none"
            />
            <Pressable style={styles.ghostBtn} onPress={onPickImage} disabled={uploading}>
              <Text style={styles.ghostText}>{uploading ? 'Đang tải...' : 'Chọn ảnh'}</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Ảnh công khai, nhỏ hơn 5 MB. Điện thoại Android hiện banner ngay; iPhone cần bản app đã bật ảnh thông báo.</Text>

          <Text style={styles.label}>Link khi bấm vào thông báo</Text>
          <TextInput
            style={styles.input}
            value={form.actionUrl}
            onChangeText={(actionUrl) => patch({ actionUrl })}
            placeholder="/rewards, /jobs/123 hoặc https://"
            placeholderTextColor={Colors.textLight}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>/rewards và /promotions mở trang quà. /jobs/mã-tin mở đúng tin đó.</Text>

          <Text style={styles.label}>Lịch gửi</Text>
          <View style={styles.choiceRow}>
            {[
              { id: 'now', label: 'Gửi ngay lập tức' },
              { id: 'schedule', label: 'Hẹn giờ gửi' },
            ].map((item) => {
              const on = form.sendMode === item.id;
              return (
                <Pressable key={item.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => patch({ sendMode: item.id })}>
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {form.sendMode === 'schedule' ? (
            <View style={styles.block}>
              <Text style={styles.hint}>Giờ Việt Nam. Nếu không thấy lịch, nhập ngày dạng 2026-10-14 và giờ dạng 09:30.</Text>
              <WebClock
                date={form.date}
                time={form.time}
                onDate={(date) => {
                  const day = Number(String(date).slice(8, 10));
                  patch({ date, monthDay: day ? String(day) : form.monthDay });
                }}
                onTime={(time) => patch({ time })}
              />
            </View>
          ) : (
            <Text style={styles.hint}>Bấm nút bên dưới là gửi ngay. Nếu có lặp lại, các lần sau tính từ giờ này.</Text>
          )}

          <Text style={styles.label}>Lặp lại</Text>
          <View style={styles.choiceRow}>
            {RECURRENCE.map((item) => {
              const on = form.recurrence === item.id;
              return (
                <Pressable key={item.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => patch({ recurrence: item.id })}>
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{recurrence.hint}</Text>

          {form.recurrence === 'weekly' ? (
            <View style={styles.choiceRow}>
              {WEEKDAYS.map((item) => {
                const on = form.weekday === item.id;
                return (
                  <Pressable key={item.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => patch({ weekday: item.id })}>
                    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {form.recurrence === 'monthly' ? (
            <View style={styles.block}>
              <Text style={styles.hint}>Ngày trong tháng</Text>
              <TextInput
                style={[styles.input, styles.dayInput]}
                value={String(form.monthDay)}
                onChangeText={(monthDay) => patch({ monthDay: monthDay.replace(/[^\d]/g, '').slice(0, 2) })}
                keyboardType="number-pad"
                placeholder="1–31"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          ) : null}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <Pressable style={[styles.primary, (busy || uploading) && styles.primaryOff]} onPress={onSubmit} disabled={busy || uploading}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={styles.primaryText}>
                {form.id ? 'Lưu thay đổi' : form.sendMode === 'now' ? 'Gửi ngay' : 'Hẹn giờ gửi'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.previewCol, compact && styles.previewColStack]}>
          <Text style={styles.previewLabel}>Xem trước trên điện thoại</Text>
          <PhonePreview
            title={form.title}
            body={form.body}
            imageUrl={form.imageUrl}
            imageOk={brokenImage !== form.imageUrl.trim()}
            onImageError={() => setBrokenImage(form.imageUrl.trim())}
          />
          {form.actionUrl.trim() ? <Text style={styles.previewLink}>Bấm vào sẽ mở: {form.actionUrl.trim()}</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Lịch sử gửi</Text>
        <Text style={styles.hint}>
          Tin đến giờ được gửi tự động. Nếu máy chủ chưa bật lịch chạy nền, mở màn này cũng sẽ gửi các tin đã đến hạn.
        </Text>
        <View style={styles.choiceRow}>
          {STATUS_FILTERS.map((item) => {
            const on = statusFilter === item.id;
            return (
              <Pressable key={item.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => setStatusFilter(item.id)}>
                <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={tableQuery}
          onChangeText={setTableQuery}
          placeholder="Tìm theo tiêu đề hoặc người nhận"
          placeholderTextColor={Colors.textLight}
        />
        {listError ? <Text style={styles.error}>{listError}</Text> : null}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.trHead}>
                <Text style={[styles.th, styles.colTitle]}>Tiêu đề</Text>
                <Text style={[styles.th, styles.colTarget]}>Đối tượng</Text>
                <Text style={[styles.th, styles.colWhen]}>Lịch</Text>
                <Text style={[styles.th, styles.colStatus]}>Trạng thái</Text>
                <Text style={[styles.th, styles.colWhen]}>Lần gửi</Text>
                <Text style={[styles.th, styles.colActions]}>Thao tác</Text>
              </View>
              {visibleRows.length === 0 ? (
                <Text style={styles.empty}>Chưa có chiến dịch nào trong bộ lọc này.</Text>
              ) : (
                visibleRows.map((row) => {
                  const look = STATUS_LOOK[row.status] || STATUS_LOOK.pending;
                  return (
                    <View key={row.id} style={styles.tr}>
                      <View style={styles.colTitle}>
                        <Text style={styles.cellStrong} numberOfLines={2}>{row.title}</Text>
                        {row.last_error ? <Text style={styles.cellError}>{row.last_error}</Text> : null}
                      </View>
                      <Text style={[styles.cell, styles.colTarget]} numberOfLines={3}>{row.target_label || '—'}</Text>
                      <View style={styles.colWhen}>
                        <Text style={styles.cell}>{recurrenceText(row)}</Text>
                        {row.next_run_at && row.status !== 'sent' ? (
                          <Text style={styles.cellMuted}>Tới: {formatWhen(row.next_run_at)}</Text>
                        ) : null}
                      </View>
                      <View style={styles.colStatus}>
                        <View style={[styles.pill, { backgroundColor: look.bg }]}>
                          <Text style={[styles.pillText, { color: look.color }]}>{look.label}</Text>
                        </View>
                        {row.sent_count ? <Text style={styles.cellMuted}>{row.sent_count} lần</Text> : null}
                      </View>
                      <Text style={[styles.cell, styles.colWhen]}>{formatWhen(row.last_sent_at)}</Text>
                      <View style={[styles.actions, styles.colActions]}>
                        <Pressable onPress={() => beginEdit(row)}>
                          <Text style={styles.link}>Sửa</Text>
                        </Pressable>
                        <Pressable onPress={() => setPendingDelete(row)}>
                          <Text style={styles.danger}>Xóa</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={!!pendingDelete} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPendingDelete(null)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Xóa chiến dịch này?</Text>
            <Text style={styles.hint}>
              {pendingDelete?.title || 'Thông báo'} sẽ bị xóa. Nếu đang hẹn giờ hoặc lặp lại, các lần sau sẽ không gửi nữa.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.ghostBtn} onPress={() => setPendingDelete(null)}>
                <Text style={styles.ghostText}>Giữ lại</Text>
              </Pressable>
              <Pressable style={styles.dangerBtn} onPress={onDelete} disabled={busy}>
                <Text style={styles.primaryText}>{busy ? 'Đang xóa...' : 'Xóa'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48, gap: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: Colors.textMuted, lineHeight: 20, marginTop: -8 },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  composerStack: { flexDirection: 'column' },
  card: {
    flex: 1.4,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 16,
    gap: 8,
  },
  previewCol: { width: 320, gap: 8 },
  previewColStack: { width: '100%', alignItems: 'center' },
  previewLabel: { fontWeight: '800', color: '#0F172A' },
  previewLink: { color: Colors.textMuted, fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  label: { marginTop: 8, fontWeight: '800', color: '#0F172A', fontSize: 13 },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  counter: { alignSelf: 'flex-end', color: Colors.textLight, fontSize: 11, marginTop: -4 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#101828',
  },
  area: { minHeight: 110, textAlignVertical: 'top' },
  flexInput: { flex: 1 },
  dayInput: { maxWidth: 120 },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  clockRow: { flexDirection: 'row', gap: 8 },
  clockInput: { flex: 1 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  choiceOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  choiceText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  choiceTextOn: { color: Colors.primary },
  block: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: Colors.primaryDark, fontWeight: '700', fontSize: 12 },
  hit: {
    borderWidth: 1,
    borderColor: '#EEF2F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hitName: { fontWeight: '800', color: '#0F172A' },
  hitMeta: { color: Colors.textMuted, fontSize: 12 },
  editBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editText: { fontWeight: '800', color: Colors.primary },
  link: { color: Colors.primary, fontWeight: '800' },
  danger: { color: '#B42318', fontWeight: '800' },
  primary: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  ghostText: { color: '#0F172A', fontWeight: '800' },
  error: { color: '#B42318', lineHeight: 18 },
  banner: { borderRadius: 12, padding: 12 },
  bannerOk: { backgroundColor: '#ECFDF3' },
  bannerWarn: { backgroundColor: '#FFFAEB' },
  bannerText: { fontWeight: '700', lineHeight: 18 },
  bannerTextOk: { color: '#027A48' },
  bannerTextWarn: { color: '#B54708' },
  phone: {
    width: 280,
    borderRadius: 36,
    borderWidth: 8,
    borderColor: '#0F172A',
    backgroundColor: '#E8EEF9',
    padding: 14,
    paddingTop: 18,
    alignItems: 'center',
    gap: 12,
  },
  phoneSpeaker: { width: 72, height: 6, borderRadius: 99, backgroundColor: '#0F172A' },
  phoneClock: { fontSize: 42, fontWeight: '300', color: '#0F172A' },
  note: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteApp: { flex: 1, fontSize: 11, fontWeight: '800', color: '#64748B' },
  noteTime: { fontSize: 11, color: '#94A3B8' },
  noteTitle: { fontWeight: '800', color: '#0F172A' },
  noteBody: { color: '#334155', fontSize: 13, lineHeight: 18 },
  noteImage: { marginTop: 6, height: 110, borderRadius: 12, backgroundColor: '#E2E8F0' },
  loader: { marginVertical: 20 },
  trHead: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    alignItems: 'flex-start',
  },
  th: { fontSize: 12, fontWeight: '800', color: '#94A3B8' },
  cell: { color: '#334155', fontSize: 13, lineHeight: 18 },
  cellStrong: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  cellMuted: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  cellError: { color: '#B42318', fontSize: 12, marginTop: 4 },
  colTitle: { width: 240, paddingRight: 12 },
  colTarget: { width: 160, paddingRight: 12 },
  colWhen: { width: 170, paddingRight: 12 },
  colStatus: { width: 110, paddingRight: 12, gap: 4 },
  colActions: { width: 110 },
  actions: { flexDirection: 'row', gap: 12 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
  empty: { color: Colors.textMuted, paddingVertical: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  dangerBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#B42318',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
