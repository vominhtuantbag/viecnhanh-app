import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Radius, Shadow } from '@/constants/colors';
import { formatPrice, statusLabel, viewLabel } from '@/data/jobs';

const CYCLE_MS = 6000;

export default function RecentJobsCarousel({ jobs = [], onPress }) {
  const scrollRef = useRef(null);
  const head = jobs[0]?.id || '';
  const [seenHead, setSeenHead] = useState(head);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);

  if (head !== seenHead) {
    setSeenHead(head);
    if (seenHead && head) {
      setIndex(0);
      setCycle((value) => value + 1);
    }
  }
  if (jobs.length > 0 && index > jobs.length - 1) {
    setIndex(0);
  }

  useEffect(() => {
    if (!width || cycle === 0) return undefined;
    scrollRef.current?.scrollTo({ x: 0, animated: true });
    return undefined;
  }, [cycle, width]);

  useEffect(() => {
    if (!width || jobs.length < 2 || paused) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % jobs.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [width, jobs.length, paused, cycle]);

  if (!jobs.length) return null;

  function settle(offsetX) {
    if (!width) return;
    const next = Math.round(offsetX / width);
    setIndex(Math.max(0, Math.min(jobs.length - 1, next)));
    setPaused(false);
  }

  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}>
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          snapToInterval={width}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setPaused(true)}
          onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.x)}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}>
          {jobs.map((job) => (
            <View key={job.id} style={{ width }}>
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => onPress?.(job)}>
                <View style={styles.top}>
                  <Text style={styles.title} numberOfLines={2}>
                    {job.title}
                  </Text>
                  <Text style={styles.price}>{formatPrice(job.price)}</Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="location-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {job.place}
                  </Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="calendar-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{job.stamp}</Text>
                </View>
                <View style={styles.bottom}>
                  <View style={styles.pill}>
                    <View style={styles.dot} />
                    <Text style={styles.pillText}>{job.statusText || statusLabel(job.status)}</Text>
                  </View>
                  <View style={styles.views}>
                    <Ionicons name="eye-outline" size={15} color={Colors.textLight} />
                    <Text style={styles.viewText}>{viewLabel(job.views)}</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...Shadow.soft,
  },
  cardPressed: {
    backgroundColor: '#F8FAFF',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
  },
  bottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  pillText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  views: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '600',
  },
  placeholder: {
    height: 148,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
});
