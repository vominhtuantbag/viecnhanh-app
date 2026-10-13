import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Radius } from '@/constants/colors';
import { PROVINCES, getProvinceById, getWardById } from '@/data/locations';

export function AreaPicker({ provinceId, wardId, onChange }) {
  const [openField, setOpenField] = useState(null);

  const province = getProvinceById(provinceId);
  const ward = getWardById(provinceId, wardId);

  const options = useMemo(() => {
    if (openField === 'province') {
      return PROVINCES.map((item) => ({ id: item.id, name: item.name }));
    }
    const wards = getProvinceById(provinceId)?.wards ?? [];
    return wards.map((item) => ({ id: item.id, name: item.name }));
  }, [openField, provinceId]);

  function selectOption(id) {
    if (openField === 'province') {
      onChange({ provinceId: id, wardId: '' });
    } else {
      onChange({ provinceId, wardId: id });
    }
    setOpenField(null);
  }

  return (
    <View style={styles.row}>
      <SelectButton
        label="Tỉnh/Thành"
        value={province?.name ?? 'Chọn'}
        onPress={() => setOpenField('province')}
      />
      <SelectButton
        label="Xã/Phường"
        value={ward?.name ?? 'Chọn'}
        onPress={() => province && setOpenField('ward')}
        disabled={!province}
      />

      <Modal visible={Boolean(openField)} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpenField(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {openField === 'province' ? 'Chọn Tỉnh/Thành' : 'Chọn Xã/Phường'}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => selectOption(item.id)}>
                  <Text style={styles.optionText}>{item.name}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SelectButton({ label, value, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.select, disabled && styles.selectDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={styles.selectLabel}>{label}</Text>
      <Text style={styles.selectValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  select: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectDisabled: {
    opacity: 0.5,
  },
  selectLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
    fontWeight: '600',
  },
  selectValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
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
    maxHeight: '60%',
    padding: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    color: Colors.text,
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
  },
});
