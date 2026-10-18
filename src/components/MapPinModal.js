import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapCanvas } from '@/components/MapCanvas';
import { Colors, Radius } from '@/constants/colors';
import { areaFromCoordinates } from '@/services/geo';

function firstPin(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const has =
    latitude != null &&
    longitude != null &&
    latitude !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);
  if (has) return { latitude: lat, longitude: lng };
  return { latitude: 16.047079, longitude: 108.20623 };
}

export function MapPinModal({ latitude, longitude, onClose, onConfirm }) {
  const initial = firstPin(latitude, longitude);
  const pinRef = useRef(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    const pin = pinRef.current;
    try {
      const area = await areaFromCoordinates(pin);
      const address = area?.label || '';
      if (!address) {
        setError('Chưa đọc được địa chỉ tại điểm này. Hãy ghim chỗ khác.');
        return;
      }
      await onConfirm({
        latitude: pin.latitude,
        longitude: pin.longitude,
        address,
      });
    } catch (err) {
      setError(err.message || 'Không đọc được địa chỉ trên bản đồ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Chọn vị trí trên bản đồ</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={onClose} disabled={busy} hitSlop={8}>
            <Text style={styles.close}>Đóng</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Kéo ghim hoặc chạm vào bản đồ để chọn đúng chỗ. Tỉnh và xã ở hồ sơ không đổi.</Text>
        <View style={styles.map}>
          <MapCanvas
            latitude={initial.latitude}
            longitude={initial.longitude}
            onPin={(point) => {
              pinRef.current = point;
            }}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dùng vị trí này"
          style={[styles.use, busy && styles.busy]}
          onPress={confirm}
          disabled={busy}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.useText}>Dùng vị trí này</Text>}
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  close: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  note: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  map: {
    flex: 1,
    minHeight: 0,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#E7EDF6',
  },
  error: {
    marginTop: 8,
    color: '#D92D20',
    fontWeight: '700',
    fontSize: 13,
  },
  use: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  busy: {
    opacity: 0.75,
  },
});
