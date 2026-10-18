import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteMapCanvas } from '@/components/RouteMapCanvas';
import { Colors, Radius } from '@/constants/colors';
import { fetchRoadRoute, formatAway } from '@/services/geo';

function hasPoint(point) {
  return Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude));
}

export function RouteMapModal({ from, to, onClose }) {
  const [route, setRoute] = useState(null);
  const pairKey = hasPoint(from) && hasPoint(to)
    ? `${from.latitude},${from.longitude}:${to.latitude},${to.longitude}`
    : '';
  const current = route?.key === pairKey ? route : null;

  useEffect(() => {
    if (!pairKey) return undefined;
    let alive = true;
    fetchRoadRoute(from, to)
      .then((next) => {
        if (!alive) return;
        setRoute(next ? { key: pairKey, ...next } : { key: pairKey, km: null, line: [] });
      })
      .catch(() => {
        if (alive) setRoute({ key: pairKey, km: null, line: [] });
      });
    return () => {
      alive = false;
    };
  }, [from, pairKey, to]);

  const waiting = Boolean(pairKey) && !current;
  const note = !hasPoint(to)
    ? 'Tin này chưa có vị trí trên bản đồ.'
    : !hasPoint(from)
      ? 'Bật vị trí để xem đường từ chỗ bạn đến việc.'
      : current
        ? formatAway(current.km)
        : 'Đang vẽ đường đi...';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Đường đến việc</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>Đóng</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>{note}</Text>
        <View style={styles.map}>
          {waiting ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : null}
          {hasPoint(to) || hasPoint(from) ? (
            <RouteMapCanvas from={from} to={to} line={current?.line || []} />
          ) : null}
        </View>
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
    minHeight: 18,
  },
  map: {
    flex: 1,
    minHeight: 0,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#E7EDF6',
  },
  loader: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 2,
  },
});
