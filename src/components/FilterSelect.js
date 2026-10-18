import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Radius } from '@/constants/colors';

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
  variant = 'chip',
  highlighted = false,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);

  const menu = (
    <Modal visible={open} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{label || 'Bộ lọc'}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                }}>
                <Text style={[styles.optionText, item.id === value && styles.optionActive]}>
                  {item.name}
                </Text>
                {item.id === value ? (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                ) : null}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (variant === 'tab') {
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label || 'Bộ lọc'}
          onPress={() => setOpen(true)}
          style={[styles.tabTrigger, highlighted && styles.tabTriggerOn]}>
          <Text
            style={[styles.tabTriggerText, highlighted && styles.tabTriggerTextOn]}
            numberOfLines={1}>
            {label || 'Bộ lọc'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={highlighted ? Colors.primary : Colors.textMuted}
            style={styles.tabChevron}
          />
        </Pressable>
        {menu}
      </>
    );
  }

  return (
    <>
      <Pressable style={[styles.chip, compact && styles.chipCompact]} onPress={() => setOpen(true)}>
        {label ? <Text style={styles.chipLabel}>{label}</Text> : null}
        <Text style={[styles.chipValue, compact && styles.chipValueCompact]} numberOfLines={1}>
          {selected?.name ?? 'Tất cả'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.primary} />
      </Pressable>
      {menu}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 168,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  chipCompact: {
    minWidth: 0,
    flexShrink: 0,
    paddingHorizontal: 10,
  },
  chipValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  chipValueCompact: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    maxWidth: 108,
    textAlign: 'left',
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '55%',
    padding: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
  },
  optionActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tabTrigger: {
    flex: 1,
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  tabTriggerOn: {
    backgroundColor: Colors.primarySoft,
  },
  tabTriggerText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTriggerTextOn: {
    color: Colors.primary,
  },
  tabChevron: {
    position: 'absolute',
    right: 8,
  },
});
