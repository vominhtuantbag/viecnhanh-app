import { useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { prizeSentence } from '@/data/luckGames';

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 128;
const COLORS = ['#0052FF', '#12B76A', '#F79009', '#7A5AF8', '#F04438', '#06AED4', '#EE46BC', '#FDB022'];

function polar(angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [CENTER + RADIUS * Math.cos(radians), CENTER + RADIUS * Math.sin(radians)];
}

function slicePath(start, end) {
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2} Z`;
}

function shortName(prize) {
  const name = String(prize?.prizeName || '').trim();
  if (name.length <= 12) return name;
  return `${name.slice(0, 11)}…`;
}

function landingIndex(prizes, result) {
  const byId = prizes.findIndex((prize) => prize.id && prize.id === result?.prizeId);
  if (byId >= 0) return byId;
  const byValue = prizes.findIndex(
    (prize) => prize.prizeType === 'coin' && Number(prize.value) === Number(result?.value)
  );
  return byValue >= 0 ? byValue : 0;
}

export default function LuckyWheel({ prizes, turns, onClose, onSpin }) {
  const [rotation] = useState(() => new Animated.Value(0));
  const rotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const slices = prizes.length ? prizes : [];
  const sweep = slices.length ? 360 / slices.length : 360;

  const spinAngle = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  function spinTo(index, prize) {
    const center = index * sweep + sweep / 2;
    const current = ((rotationRef.current % 360) + 360) % 360;
    let delta = (360 - center) - current;
    if (delta < 0) delta += 360;
    delta += 360 * 5;
    const next = rotationRef.current + delta;
    rotationRef.current = next;
    Animated.timing(rotation, {
      toValue: next,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setSpinning(false);
      setResult(prize);
    });
  }

  async function spin() {
    if (spinning) return;
    if ((Number(turns) || 0) < 1) {
      Alert.alert('Hết lượt', 'Bạn chưa có lượt quay.');
      return;
    }
    setResult(null);
    setSpinning(true);
    try {
      const prize = await onSpin();
      spinTo(landingIndex(slices, prize), prize);
    } catch (err) {
      setSpinning(false);
      Alert.alert('Chưa quay được', err?.message || 'Thử lại sau.');
    }
  }

  function close() {
    if (spinning) return;
    setResult(null);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Vòng quay may mắn</Text>
          <Text style={styles.sub}>Còn {Number(turns) || 0} lượt</Text>
          <View style={styles.pointer} />
          <View style={styles.wheelWrap}>
            <Animated.View style={{ transform: [{ rotate: spinAngle }] }}>
              <Svg width={SIZE} height={SIZE}>
                {slices.map((prize, index) => {
                  const start = index * sweep;
                  const end = slices.length === 1 ? 359.99 : start + sweep;
                  const mid = start + sweep / 2;
                  const flip = mid > 90 && mid < 270;
                  const labelY = CENTER - RADIUS * 0.62;
                  return (
                    <G key={prize.id || index}>
                      <Path d={slicePath(start, end)} fill={COLORS[index % COLORS.length]} />
                      <G transform={`rotate(${mid} ${CENTER} ${CENTER})`}>
                        <SvgText
                          x={CENTER}
                          y={labelY}
                          fill="#FFFFFF"
                          fontSize="13"
                          fontWeight="700"
                          textAnchor="middle"
                          transform={flip ? `rotate(180 ${CENTER} ${labelY})` : undefined}>
                          {shortName(prize)}
                        </SvgText>
                      </G>
                    </G>
                  );
                })}
              </Svg>
            </Animated.View>
            <View style={styles.hub} />
            <Pressable style={[styles.quay, (spinning || (Number(turns) || 0) < 1) && styles.quayOff]} disabled={spinning} onPress={spin}>
              <Text style={styles.quayText}>{spinning ? '...' : 'QUAY'}</Text>
            </Pressable>
          </View>
          {result ? (
            <View style={styles.win}>
              <Text style={styles.winTitle}>Chúc mừng!</Text>
              <Text style={styles.winBody}>{prizeSentence(result)}</Text>
            </View>
          ) : null}
          <Pressable style={styles.close} disabled={spinning} onPress={close}>
            <Text style={styles.closeText}>{spinning ? 'Đang quay...' : 'Đóng'}</Text>
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
    alignItems: 'center',
    ...Shadow.card,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  sub: { color: Colors.textMuted, marginTop: 4, marginBottom: 8 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F04438',
    zIndex: 3,
    marginBottom: -8,
  },
  wheelWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  hub: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
  },
  quay: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quayOff: { backgroundColor: '#98A2B3' },
  quayText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  win: {
    marginTop: 14,
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.md,
    padding: 12,
    alignSelf: 'stretch',
  },
  winTitle: { color: Colors.success, fontWeight: '800', textAlign: 'center' },
  winBody: { color: Colors.text, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  close: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 18 },
  closeText: { color: Colors.primary, fontWeight: '800' },
});
