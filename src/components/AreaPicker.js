import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Radius } from '@/constants/colors';
import { useCatalog, visibleProvinces } from '@/data/catalog';
import { getProvinceById, getWardById } from '@/data/locations';

export function AreaPicker({ provinceId, wardId, onChange }) {
  const catalog = useCatalog();
  const [openField, setOpenField] = useState(null);
  const [query, setQuery] = useState('');

  const province = getProvinceById(provinceId);
  const ward = getWardById(provinceId, wardId);
  const visible = visibleProvinces(catalog);

  useEffect(() => {
    setQuery('');
  }, [openField]);

  const options = useMemo(() => {
    const source =
      openField === 'province'
        ? visible.map((item) => ({ id: item.id, name: item.name }))
        : (visible.find((item) => item.id === province?.id)?.wards ?? []).map((item) => ({
            id: item.id,
            name: item.name,
          }));
    const text = query.trim().toLowerCase();
    if (!text) return source;
    return source.filter((item) => item.name.toLowerCase().includes(text));
  }, [openField, province?.id, query, visible]);

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
        value={province && province.status !== 'hide' ? province.name : 'Chọn'}
        onPress={() => setOpenField('province')}
      />
      <SelectButton
        label="Xã/Phường"
        value={ward && ward.status !== 'hide' && province?.status !== 'hide' ? ward.name : 'Chọn'}
        onPress={() => province && province.status !== 'hide' && setOpenField('ward')}
        disabled={!province || province.status === 'hide'}
      />

      <Modal visible={Boolean(openField)} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpenField(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {openField === 'province' ? 'Chọn Tỉnh/Thành' : 'Chọn Xã/Phường'}
            </Text>
            <TextInput
              style={styles.search}
              placeholder="Tìm tên"
              placeholderTextColor={Colors.textLight}
              value={query}
              onChangeText={setQuery}
            />
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
  search: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
