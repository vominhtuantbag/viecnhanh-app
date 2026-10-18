import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { Colors, Radius } from '@/constants/colors';
import { slotsFor, fetchAdminVerification, reviewVerification, saveRequirement } from '@/services/verification';

const SIDE_LABEL = { front: 'Mặt trước', back: 'Mặt sau' };

export default function AdminVerificationBoard() {
  const [requirements, setRequirements] = useState([]);
  const [queue, setQueue] = useState([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [required, setRequired] = useState(true);
  const [bothSides, setBothSides] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchAdminVerification();
      setRequirements(data.requirements);
      setQueue(data.queue);
      setOffline(data.offline);
    } catch (err) {
      setError(err.message || 'Không tải được hàng chờ xác minh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  async function run(key, task) {
    setBusy(key);
    setError('');
    try {
      await task();
      await load();
    } catch (err) {
      setError(err.message || 'Không lưu được.');
    } finally {
      setBusy('');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Quy tắc giấy tờ</Text>
      <Text style={styles.hint}>
        Bật hoặc tắt từng loại. Chỉ người đã gửi đủ giấy tờ đang bật và bắt buộc mới hiện trong hàng chờ.
      </Text>
      {offline ? (
        <Text style={styles.warn}>Chưa có bảng trên máy chủ. Hãy chạy file SQL xác minh một lần rồi tải lại.</Text>
      ) : null}
      {loading ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : null}
      {requirements.map((item) => (
        <View key={item.id} style={styles.rule}>
          {editing === item.id ? (
            <TextInput
              style={styles.input}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Tên giấy tờ"
              placeholderTextColor={Colors.textLight}
            />
          ) : (
            <Text style={styles.ruleTitle}>{item.title}</Text>
          )}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Đang dùng</Text>
            <Switch
              value={item.is_enabled !== false}
              onValueChange={(value) =>
                run(`enabled-${item.id}`, () => saveRequirement('update', { ...item, is_enabled: value }))
              }
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Bắt buộc</Text>
            <Switch
              value={Boolean(item.is_required)}
              onValueChange={(value) =>
                run(`required-${item.id}`, () => saveRequirement('update', { ...item, is_required: value }))
              }
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>
          <View style={styles.actions}>
            {editing === item.id ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() =>
                  run(`edit-${item.id}`, async () => {
                    await saveRequirement('update', { ...item, title: draftTitle });
                    setEditing(null);
                  })
                }>
                <Text style={styles.link}>Lưu tên</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setEditing(item.id);
                  setDraftTitle(item.title);
                }}>
                <Text style={styles.link}>Sửa</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.linkBtn}
              onPress={() => {
                if (confirmDelete !== item.id) {
                  setConfirmDelete(item.id);
                  return;
                }
                run(`delete-${item.id}`, () => saveRequirement('delete', item));
                setConfirmDelete('');
              }}>
              <Text style={styles.danger}>{confirmDelete === item.id ? 'Bấm lần nữa để xoá' : 'Xoá'}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={styles.rule}>
        <Text style={styles.ruleTitle}>Thêm loại giấy tờ</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ví dụ: Hộ chiếu"
          placeholderTextColor={Colors.textLight}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Bắt buộc</Text>
          <Switch value={required} onValueChange={setRequired} trackColor={{ true: Colors.primary, false: Colors.border }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Cần mặt sau</Text>
          <Switch value={bothSides} onValueChange={setBothSides} trackColor={{ true: Colors.primary, false: Colors.border }} />
        </View>
        <Pressable
          style={[styles.primary, (!title.trim() || busy === 'create') && styles.disabled]}
          disabled={!title.trim() || busy === 'create'}
          onPress={() =>
            run('create', async () => {
              await saveRequirement('create', {
                id: title,
                title,
                is_enabled: true,
                is_required: required,
                needs_back: bothSides,
                sort_order: requirements.length + 1,
              });
              setTitle('');
            })
          }>
          <Text style={styles.primaryText}>{busy === 'create' ? 'Đang thêm...' : 'Thêm'}</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Danh sách chờ xác minh</Text>
      {queue.length === 0 && !loading ? (
        <Text style={styles.empty}>Chưa có ai gửi đủ giấy tờ bắt buộc.</Text>
      ) : null}
      {queue.map((person) => (
        <View key={person.id} style={styles.person}>
          <Text style={styles.ruleTitle}>{person.name}</Text>
          <Text style={styles.phone}>{person.phone || 'Chưa có số điện thoại'}</Text>
          {requirements
            .filter((item) => item.is_enabled && item.is_required)
            .map((rule) => (
              <View key={rule.id} style={styles.docBlock}>
                <Text style={styles.docTitle}>{rule.title}</Text>
                <View style={styles.photos}>
                  {slotsFor(rule).map((side) => {
                    const doc = person.documents.find(
                      (item) => item.requirement_id === rule.id && item.side === side
                    );
                    return (
                      <View key={side} style={styles.photo}>
                        {doc?.previewUrl ? (
                          <Image source={{ uri: doc.previewUrl }} style={styles.image} contentFit="cover" />
                        ) : (
                          <Text style={styles.missing}>Chưa có ảnh</Text>
                        )}
                        <Text style={styles.side}>{SIDE_LABEL[side]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          <TextInput
            style={styles.input}
            value={reasons[person.id] || ''}
            onChangeText={(text) => setReasons((current) => ({ ...current, [person.id]: text }))}
            placeholder="Lý do từ chối, nếu không duyệt"
            placeholderTextColor={Colors.textLight}
          />
          <View style={styles.reviewRow}>
            <Pressable
              style={[styles.approve, busy === `ok-${person.id}` && styles.disabled]}
              onPress={() => run(`ok-${person.id}`, () => reviewVerification(person.id, 'approved'))}>
              <Text style={styles.primaryText}>Duyệt</Text>
            </Pressable>
            <Pressable
              style={[styles.reject, busy === `no-${person.id}` && styles.disabled]}
              onPress={() =>
                run(`no-${person.id}`, () => reviewVerification(person.id, 'rejected', reasons[person.id]))
              }>
              <Text style={styles.rejectText}>Từ chối</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  heading: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  warn: {
    color: '#B54708',
    fontSize: 13,
    lineHeight: 18,
  },
  loader: {
    marginVertical: 12,
  },
  rule: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
  },
  ruleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: Colors.text,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  linkBtn: {
    paddingVertical: 4,
  },
  link: {
    color: Colors.primary,
    fontWeight: '800',
  },
  danger: {
    color: '#D92D20',
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
  },
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  empty: {
    color: Colors.textMuted,
    marginTop: 4,
  },
  person: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
  },
  phone: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  docBlock: {
    gap: 6,
  },
  docTitle: {
    fontWeight: '700',
    color: Colors.text,
  },
  photos: {
    flexDirection: 'row',
    gap: 8,
  },
  photo: {
    flex: 1,
    gap: 4,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  missing: {
    height: 120,
    borderRadius: 8,
    backgroundColor: Colors.background,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: 48,
    color: Colors.textMuted,
  },
  side: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  approve: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  reject: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D92D20',
  },
  rejectText: {
    color: '#D92D20',
    fontWeight: '800',
  },
  error: {
    color: '#D92D20',
    fontWeight: '700',
  },
});
