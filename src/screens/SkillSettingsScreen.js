import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useCatalog, visibleMains, visibleSkills } from '@/data/catalog';
import { readLocalSkills, saveProfileSkills } from '@/services/profiles';

export default function SkillSettingsScreen() {
  const catalog = useCatalog();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const groups = visibleMains(catalog)
    .map((main) => ({
      main,
      skills: visibleSkills(catalog).filter((item) => item.parentId === main.id),
    }))
    .filter((group) => group.skills.length);

  useEffect(() => {
    if (authLoading) return;
    if (!session) router.replace('/(auth)/login');
  }, [authLoading, session]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!profile?.id) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const fromProfile = Array.isArray(profile.skill_ids) ? profile.skill_ids : [];
    readLocalSkills(profile.id).then((local) => {
      if (cancelled) return;
      setSelected(fromProfile.length ? fromProfile : local);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, profile?.id, profile?.skill_ids]);

  function toggle(id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveProfileSkills(profile.id, selected);
      await refreshProfile().catch(() => {});
      Alert.alert(
        'Đã lưu kỹ năng',
        result.storedLocally
          ? 'Máy này đã nhớ lựa chọn. Để người khác thấy trên hồ sơ, cần thêm cột kỹ năng trên máy chủ.'
          : 'Kỹ năng đã hiện trên hồ sơ của bạn.'
      );
    } catch (err) {
      Alert.alert('Không lưu được', err.message || 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session || loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>Tích những việc bạn làm được. Có thể chọn nhiều kỹ năng.</Text>
        <Text style={styles.count}>Đã chọn {selected.length} kỹ năng</Text>
        {groups.length === 0 ? <Text style={styles.empty}>Chưa có kỹ năng nào đang hiện.</Text> : null}
        {groups.map((group) => (
          <View key={group.main.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.main.name}</Text>
            <View style={styles.card}>
              {group.skills.map((item, index) => {
                const on = selected.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.row, index === group.skills.length - 1 && styles.rowLast]}
                    onPress={() => toggle(item.id)}>
                    <Text style={[styles.label, on && styles.labelOn]}>{item.name}</Text>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={on ? Colors.primary : Colors.textLight}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Pressable style={[styles.save, saving && styles.saveOff]} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Lưu kỹ năng'}</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.push(`/user/${profile.id}`)}>
          <Text style={styles.linkText}>Xem hồ sơ của tôi</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { marginTop: 32 },
  content: { padding: 20, paddingBottom: 40 },
  help: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  count: { marginTop: 8, marginBottom: 12, color: Colors.primary, fontWeight: '800' },
  empty: { color: Colors.textMuted },
  group: { marginBottom: 16 },
  groupTitle: { marginBottom: 8, fontSize: 13, fontWeight: '800', color: Colors.textMuted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '600' },
  labelOn: { color: Colors.primary },
  save: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveOff: { opacity: 0.6 },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  link: { marginTop: 14, alignItems: 'center' },
  linkText: { color: Colors.primary, fontWeight: '800' },
});
