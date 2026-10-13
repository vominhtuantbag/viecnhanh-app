import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors } from '@/constants/colors';
import { ADMIN_MENU } from '@/data/adminMenu';

const BLUE = Colors.primary;

export default function AdminSidebar({ pageId, openIds, onToggle, onSelect, floating }) {
  const current = ADMIN_MENU.find(
    (item) => item.id === pageId || (item.children || []).some((child) => child.id === pageId)
  );

  return (
    <View style={[styles.sidebar, floating && styles.floating]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.homeBtn}
          onPress={() => onSelect('dashboard')}>
          <Ionicons name="home" size={18} color="#FFFFFF" />
          <Text style={styles.homeText}>Bảng điều khiển</Text>
        </Pressable>

        {ADMIN_MENU.filter((item) => item.type !== 'home').map((item) => {
          const open = openIds.includes(item.id);
          const active = current?.id === item.id;
          return (
            <View key={item.id}>
              <Pressable style={styles.row} onPress={() => onToggle(item.id)}>
                <Ionicons name={item.icon} size={18} color={active ? BLUE : '#64748B'} />
                <Text style={[styles.label, active && styles.labelOn]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={active ? BLUE : '#94A3B8'}
                />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
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
    zIndex: 20,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
  },
  inner: { padding: 16, paddingBottom: 32 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BLUE,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  homeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  label: { flex: 1, color: '#1E293B', fontSize: 14, fontWeight: '600' },
  labelOn: { color: BLUE, fontWeight: '800' },
  tree: {
    marginLeft: 22,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    marginBottom: 4,
  },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  childOn: { backgroundColor: Colors.primarySoft },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotOn: { backgroundColor: BLUE },
  childText: { flex: 1, color: '#475569', fontSize: 13, fontWeight: '600' },
  childTextOn: { color: BLUE, fontWeight: '800' },
});
