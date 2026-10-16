import { useState } from 'react';
import { Alert, Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { prizeSentence } from '@/data/luckGames';

const BOXES = [0, 1, 2, 3, 4, 5];

function shakeOnce(value) {
  return new Promise((resolve) => {
    Animated.sequence([
      Animated.timing(value, { toValue: 7, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: -7, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: 5, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: 0, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => resolve());
  });
}

export default function MysteryBoxes({ turns, onClose, onOpen }) {
  const [shake] = useState(() => new Animated.Value(0));
  const [picked, setPicked] = useState(null);
  const [prize, setPrize] = useState(null);
  const [busy, setBusy] = useState(false);
  const locked = busy || prize;

  async function openBox(index) {
    if (locked) return;
    if ((Number(turns) || 0) < 1) {
      Alert.alert('Hết lượt', 'Bạn chưa có hộp quà.');
      return;
    }
    setPicked(index);
    setBusy(true);
    try {
      const [result] = await Promise.all([onOpen(), shakeOnce(shake)]);
      setPrize(result);
    } catch (err) {
      setPicked(null);
      Alert.alert('Chưa mở được', err?.message || 'Thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Hộp quà bí mật</Text>
          <Text style={styles.sub}>Chọn 1 trong 6 hộp · còn {Number(turns) || 0} lượt</Text>
          <View style={styles.grid}>
            {BOXES.map((index) => {
              const chosen = picked === index;
              const revealed = chosen && prize;
              return (
                <Animated.View key={index} style={[styles.slot, chosen && { transform: [{ translateX: shake }] }]}>
                  <Pressable
                    style={[styles.box, revealed && styles.boxOpen, chosen && busy && styles.boxHot, locked && !chosen && styles.boxDim]}
                    disabled={Boolean(locked)}
                    onPress={() => openBox(index)}>
                    <Ionicons name={revealed ? 'sparkles' : 'gift'} size={28} color={revealed ? Colors.success : Colors.primary} />
                    <Text style={styles.boxText}>{revealed ? prize.prizeName : 'Hộp quà'}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
          {prize ? (
            <View style={styles.win}>
              <Text style={styles.winTitle}>Mở được rồi!</Text>
              <Text style={styles.winBody}>{prizeSentence(prize)}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>Mỗi lượt chỉ mở một hộp.</Text>
          )}
          <Pressable style={styles.close} disabled={busy} onPress={close}>
            <Text style={styles.closeText}>{busy ? 'Đang mở...' : 'Đóng'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadow.card,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  sub: { color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  slot: { width: '31%' },
  box: {
    aspectRatio: 1,
    borderRadius: Radius.md,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FEDF89',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  boxOpen: { backgroundColor: Colors.successSoft, borderColor: '#ABEFC6' },
  boxHot: { borderColor: Colors.primary, borderWidth: 2 },
  boxDim: { opacity: 0.45 },
  boxText: { color: Colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center', paddingHorizontal: 4 },
  hint: { color: Colors.textMuted, textAlign: 'center', marginTop: 14 },
  win: {
    marginTop: 14,
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.md,
    padding: 12,
  },
  winTitle: { color: Colors.success, fontWeight: '800', textAlign: 'center' },
  winBody: { color: Colors.text, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  close: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  closeText: { color: Colors.primary, fontWeight: '800' },
});
