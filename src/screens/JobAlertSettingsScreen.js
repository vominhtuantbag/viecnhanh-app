import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterSelect } from '@/components/FilterSelect';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { CATEGORIES } from '@/data/categories';
import { PROVINCES, getProvinceById } from '@/data/locations';
import { useAuth } from '@/context/AuthContext';
import {
  fetchJobAlertSettings,
  mapNotifyPrefs,
  saveJobAlertSettings,
  saveNotifyPrefs,
} from '@/services/notifications';

export default function JobAlertSettingsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [enabledOverride, setEnabledOverride] = useState(null);
  const [categoryIds, setCategoryIds] = useState([]);
  const [provinceId, setProvinceId] = useState('');
  const [wardIds, setWardIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const enabled = enabledOverride ?? mapNotifyPrefs(profile).notify_new_jobs;

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let cancelled = false;
    fetchJobAlertSettings(profile.id)
      .then((settings) => {
        if (cancelled) return;
        setCategoryIds(settings.categoryIds);
        setProvinceId(settings.provinceId);
        setWardIds(settings.wardIds);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded(true);
          Alert.alert('Không tải được', err.message ?? 'Chạy migration thông báo đẩy rồi thử lại.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const wards = useMemo(() => getProvinceById(provinceId)?.wards ?? [], [provinceId]);
  const provinceOptions = useMemo(
    () => [{ id: '', name: 'Tất cả tỉnh/thành' }, ...PROVINCES.map((item) => ({ id: item.id, name: item.name }))],
    []
  );

  function toggleCategory(id) {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleWard(id) {
    setWardIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function onProvinceChange(nextId) {
    setProvinceId(nextId);
    const valid = new Set((getProvinceById(nextId)?.wards || []).map((item) => item.id));
    setWardIds((current) => current.filter((id) => valid.has(id)));
  }

  async function onToggleJobs(value) {
    setEnabledOverride(value);
    try {
      await saveNotifyPrefs(profile.id, { notify_new_jobs: value });
      await refreshProfile();
      setEnabledOverride(null);
    } catch (err) {
      setEnabledOverride(null);
      Alert.alert('Không lưu được', err.message ?? 'Vui lòng thử lại.');
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveJobAlertSettings(profile.id, { categoryIds, provinceId, wardIds });
      Alert.alert('Đã lưu', 'Hệ thống sẽ gửi việc mới đúng danh mục và khu vực bạn chọn.');
    } catch (err) {
      Alert.alert('Không lưu được', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator style={{ marginTop: 32 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {Boolean(profile?.id) && !loaded ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={Colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.title}>Nhận thông báo việc mới</Text>
                <Text style={styles.hint}>
                  Chỉ gửi khi công tắc tổng ở Tùy chọn thông báo đang bật, và tin khớp bộ lọc bên dưới.
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={onToggleJobs}
                disabled={!profile?.id || profile?.notify_push === false}
                trackColor={{ false: Colors.border, true: Colors.primarySoft }}
                thumbColor={enabled ? Colors.primary : Colors.textLight}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Lọc theo danh mục</Text>
          <Text style={styles.help}>Tích nhiều ngành. Để trống = nhận mọi danh mục.</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => setCategoryIds(CATEGORIES.map((item) => item.id))}
              style={styles.textBtn}>
              <Text style={styles.textBtnLabel}>Chọn tất cả</Text>
            </Pressable>
            <Pressable onPress={() => setCategoryIds([])} style={styles.textBtn}>
              <Text style={styles.textBtnLabel}>Xóa hết</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {CATEGORIES.map((item, index) => (
              <CheckRow
                key={item.id}
                label={item.name}
                selected={categoryIds.includes(item.id)}
                onPress={() => toggleCategory(item.id)}
                last={index === CATEGORIES.length - 1}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Lọc theo Tỉnh/Thành phố</Text>
          <View style={styles.provinceWrap}>
            <FilterSelect
              label="Tỉnh/Thành"
              value={provinceId}
              options={provinceOptions}
              onChange={onProvinceChange}
            />
          </View>

          <Text style={styles.sectionTitle}>Lọc theo Xã/Phường</Text>
          {!provinceId ? (
            <Text style={styles.help}>Chọn tỉnh/thành trước để tải danh sách xã/phường.</Text>
          ) : (
            <>
              <Text style={styles.help}>Tích nhiều xã/phường. Để trống = mọi xã/phường trong tỉnh đã chọn.</Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => setWardIds(wards.map((item) => item.id))}
                  style={styles.textBtn}>
                  <Text style={styles.textBtnLabel}>Chọn tất cả</Text>
                </Pressable>
                <Pressable onPress={() => setWardIds([])} style={styles.textBtn}>
                  <Text style={styles.textBtnLabel}>Xóa hết</Text>
                </Pressable>
              </View>
              <View style={styles.card}>
                {wards.map((item, index) => (
                  <CheckRow
                    key={item.id}
                    label={item.name}
                    selected={wardIds.includes(item.id)}
                    onPress={() => toggleWard(item.id)}
                    last={index === wards.length - 1}
                  />
                ))}
              </View>
            </>
          )}

          <Pressable
            style={[styles.save, (saving || !enabled) && styles.saveDisabled]}
            onPress={save}
            disabled={saving || !enabled}>
            <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Lưu bộ lọc'}</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CheckRow({ label, selected, onPress, last }) {
  return (
    <Pressable style={[styles.checkRow, last && styles.rowLast]} onPress={onPress}>
      <Text style={[styles.checkLabel, selected && styles.checkLabelOn]}>{label}</Text>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? Colors.primary : Colors.textLight}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 8,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  rowBody: { flex: 1 },
  title: { fontWeight: '800', color: Colors.text, fontSize: 15 },
  hint: { marginTop: 4, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  help: {
    marginBottom: 10,
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  textBtn: { paddingVertical: 4 },
  textBtnLabel: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  checkRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  checkLabel: { fontSize: 15, color: Colors.text, flex: 1, paddingRight: 12 },
  checkLabelOn: { color: Colors.primary, fontWeight: '700' },
  provinceWrap: { alignSelf: 'stretch' },
  save: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
