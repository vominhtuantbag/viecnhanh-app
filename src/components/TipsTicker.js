import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

export function tipParts(row) {
  const name = String(row?.name || 'Mẹo vặt').trim() || 'Mẹo vặt';
  let body = String(row?.body || '').trim();
  const prefix = `${name.toLowerCase()}:`;
  if (body.toLowerCase().startsWith(prefix)) {
    body = body.slice(name.length + 1).trim();
  }
  return { id: String(row?.id || name), name, body };
}

export default function TipsTicker({ tips = [] }) {
  const items = tips.map(tipParts).filter((item) => item.body || item.name);
  const stamp = items.map((item) => item.id).join('|');
  const [index, setIndex] = useState(0);
  const [seenStamp, setSeenStamp] = useState(stamp);
  const [shift] = useState(() => new Animated.Value(0));

  if (stamp !== seenStamp) {
    setSeenStamp(stamp);
    setIndex(0);
  }

  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [items.length, stamp]);

  useEffect(() => {
    shift.setValue(10);
    Animated.timing(shift, {
      toValue: 0,
      duration: 280,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, shift]);

  if (!items.length) return null;
  const item = items[index] || items[0];

  return (
    <View style={styles.bar}>
      <Animated.Text style={[styles.line, { transform: [{ translateY: shift }] }]} numberOfLines={2}>
        <Text style={styles.strong}>{item.name}: </Text>
        <Text style={styles.rest}>{item.body}</Text>
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  line: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  strong: {
    fontWeight: '800',
    color: Colors.text,
  },
  rest: {
    fontWeight: '500',
    color: Colors.text,
  },
});
