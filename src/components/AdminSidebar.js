import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors } from '@/constants/colors';
import { ADMIN_MENU } from '@/data/adminMenu';

const BLUE = Colors.primary;

const SECTIONS = [
  { title: 'Vận hành', ids: ['tasks', 'users', 'categories'] },
  { title: 'Tiền và ưu đãi', ids: ['deposits', 'promos', 'quests', 'finance'] },
  { title: 'Chăm sóc', ids: ['user-reports', 'tickets'] },
  { title: 'Hệ thống', ids: ['reports', 'admins', 'notifications', 'settings', 'extras'] },
];

export default function AdminSidebar({ pageId, openIds, onToggle, onSelect, floating }) {
  const groups = ADMIN_MENU.filter((item) => item.type !== 'home');
  const byId = Object.fromEntries(groups.map((item) => [item.id, item]));

  return (
    <View style={[styles.sidebar, floating && styles.floating]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.homeBtn} onPress={() => onSelect('dashboard')}>
          <Ionicons name="home" size={18} color="#FFFFFF" />
          <Text style={styles.homeText}>Bảng điều khiển</Text>
        </Pressable>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.ids.map((id) => byId[id]).filter(Boolean).map((item) => {
              const open = openIds.includes(item.id);
              const active = item.id === pageId || (item.children || []).some((child) => child.id === pageId);
              return (
                <View key={item.id}>
                  <Pressable style={[styles.row, active && styles.rowOn]} onPress={() => onToggle(item.id)}>
                    <Ionicons name={item.icon} size={18} color={active ? BLUE : '#64748B'} />
                    <Text style={[styles.label, active && styles.labelOn]} numberOfLines={2}>
                      {item.label}
                    </Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={active ? BLUE : '#94A3B8'} />
                  </Pressable>
                  {open ? (
                    <View style={styles.tree}>
                      {(item.children || []).map((child) => {
                        const childOn = pageId === child.id;
                        return (
                          <Pressable
                            key={child.id}
                            style={[styles.child, childOn && styles.childOn]}
                            onPress={() => onSelect(child.id)}>
                            <View style={[styles.dot, childOn && styles.dotOn]} />
                            <Text style={[styles.childText, childOn && styles.childTextOn]} numberOfLines={2}>
                              {child.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 268,
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#EEF2F6',
  },
  scroll: { flex: 1 },
  floating: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '86%',
    maxWidth: 320,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
  },
  inner: { padding: 14, paddingBottom: 28 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BLUE,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  homeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  section: { marginBottom: 8 },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 4,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowOn: { backgroundColor: '#F8FAFC' },
  label: { flex: 1, color: '#1E293B', fontSize: 14, fontWeight: '600' },
  labelOn: { color: BLUE, fontWeight: '800' },
  tree: {
    marginLeft: 16,
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  childOn: { backgroundColor: Colors.primarySoft },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotOn: { backgroundColor: BLUE },
  childText: { flex: 1, color: '#475569', fontSize: 13, fontWeight: '600' },
  childTextOn: { color: BLUE, fontWeight: '800' },
});
