import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Radius } from '@/constants/colors';
import { searchAddresses } from '@/services/geo';

export function AddressSearch({ value, onChangeText, onPick, onOpenMap }) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState({ query: '', items: [] });
  const requestId = useRef(0);
  const text = String(value || '').trim();
  const showSearch = open && text.length >= 2;
  const items = result.query === text ? result.items : [];

  useEffect(() => {
    if (!showSearch) return undefined;
    const current = requestId.current + 1;
    requestId.current = current;
    const timer = setTimeout(() => {
      setSearching(true);
      searchAddresses(text)
        .then((rows) => {
          if (requestId.current !== current) return;
          setResult({ query: text, items: rows });
        })
        .catch(() => {
          if (requestId.current !== current) return;
          setResult({ query: text, items: [] });
        })
        .finally(() => {
          if (requestId.current === current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [showSearch, text]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Số nhà, đường, phường..."
          placeholderTextColor={Colors.textLight}
          value={value}
          onChangeText={(text) => {
            setOpen(true);
            onChangeText(text);
          }}
          onFocus={() => setOpen(true)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn vị trí trên bản đồ"
          style={styles.gps}
          onPress={onOpenMap}>
          <Ionicons name="map" size={16} color="#FFFFFF" />
          <Text style={styles.gpsText}>Chọn vị trí trên bản đồ</Text>
        </Pressable>
      </View>
      {showSearch && (searching || items.length > 0) ? (
        <View style={styles.menu}>
          {searching ? <Text style={styles.hint}>Đang tìm địa chỉ...</Text> : null}
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.option}
              onPress={() => {
                setOpen(false);
                onPick(item);
              }}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <Text style={styles.optionText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    minWidth: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  gpsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  menu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  hint: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textMuted,
    fontSize: 13,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  optionText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
