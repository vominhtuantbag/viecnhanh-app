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

export function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);

  return (
    <>
      <Pressable style={styles.chip} onPress={() => setOpen(true)}>
        {label ? <Text style={styles.chipLabel}>{label}</Text> : null}
        <Text style={styles.chipValue} numberOfLines={1}>
          {selected?.name ?? 'Tất cả'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
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
                  <Text
                    style={[
                      styles.optionText,
                      item.id === value && styles.optionActive,
                    ]}>
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
  chipValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
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
});
