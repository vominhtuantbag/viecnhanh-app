import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Colors, Radius } from '@/constants/colors';

export default function BannerCarousel({ banners = [], onOpen, tone = 'plain' }) {
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState({});

  useEffect(() => {
    if (!width || banners.length < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length, width]);

  if (!banners.length) return null;
  const onBlue = tone === 'blue';

  return (
    <View
      style={[styles.wrap, onBlue && styles.wrapBlue]}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}>
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          snapToInterval={width}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            setIndex(Math.max(0, Math.min(banners.length - 1, next)));
          }}>
          {banners.map((item) => {
            const image = item.imageUrl && !broken[item.id] ? item.imageUrl : '';
            return (
              <Pressable key={item.id} style={[styles.slide, { width }]} onPress={() => onOpen?.(item)}>
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={styles.image}
                    contentFit="cover"
                    onError={() => setBroken((current) => ({ ...current, [item.id]: true }))}
                  />
                ) : (
                  <View style={styles.fallback} />
                )}
                <View style={styles.shade} />
                <Text style={styles.caption} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={[styles.placeholder, onBlue && styles.placeholderBlue]} />
      )}
      <View style={styles.dots}>
        {banners.map((item, dot) => (
          <Pressable
            key={item.id}
            onPress={() => {
              setIndex(dot);
              scrollRef.current?.scrollTo({ x: dot * width, animated: true });
            }}
            hitSlop={8}>
            <View
              style={[
                styles.dot,
                onBlue && styles.dotBlue,
                dot === index && (onBlue ? styles.dotOnBlue : styles.dotOn),
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  wrapBlue: { marginTop: 0 },
  slide: {
    height: 168,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
    justifyContent: 'flex-end',
  },
  image: { ...StyleSheet.absoluteFillObject },
  fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.primary },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  caption: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 24,
    padding: 16,
  },
  placeholder: { height: 168, borderRadius: Radius.lg, backgroundColor: Colors.primarySoft },
  placeholderBlue: { backgroundColor: 'rgba(255,255,255,0.18)' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotOn: {
    width: 18,
    backgroundColor: Colors.primary,
  },
  dotBlue: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotOnBlue: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
});
