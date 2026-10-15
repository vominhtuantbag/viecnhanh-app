import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/colors';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snap(value, min, max, step) {
  const stepped = Math.round((value - min) / step) * step + min;
  return clamp(stepped, min, max);
}

export function RangeSlider({ min, max, step = 1, low, high, onChange, single = false }) {
  const trackRef = useRef(null);
  const [box, setBox] = useState({ x: 0, width: 1 });

  function rememberTrack() {
    trackRef.current?.measureInWindow((x, _y, measured) => {
      const width = measured || 1;
      setBox((current) => (current.x === x && current.width === width ? current : { x, width }));
    });
  }

  function valueAt(pageX) {
    const ratio = (pageX - box.x) / box.width;
    return snap(min + clamp(ratio, 0, 1) * (max - min), min, max, step);
  }

  function moveThumb(which, pageX) {
    const next = valueAt(pageX);
    if (single || which === 'high') {
      onChange(single ? min : low, Math.max(next, single ? min : low));
      return;
    }
    onChange(Math.min(next, high), high);
  }

  const lowPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => moveThumb('low', event.nativeEvent.pageX),
    onPanResponderMove: (event) => moveThumb('low', event.nativeEvent.pageX),
  });
  const highPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => moveThumb('high', event.nativeEvent.pageX),
    onPanResponderMove: (event) => moveThumb('high', event.nativeEvent.pageX),
  });

  const span = max - min || 1;
  const left = ((low - min) / span) * 100;
  const right = ((high - min) / span) * 100;

  return (
    <View
      ref={trackRef}
      style={styles.trackWrap}
      onLayout={rememberTrack}
      {...(single ? highPan.panHandlers : {})}>
      <View pointerEvents="none" style={styles.track} />
      <View
        pointerEvents="none"
        style={[styles.fill, { left: `${single ? 0 : left}%`, width: `${Math.max(0, right - (single ? 0 : left))}%` }]}
      />
      {single ? null : <View style={[styles.thumb, { left: `${left}%` }]} {...lowPan.panHandlers} />}
      <View style={[styles.thumb, { left: `${right}%` }]} {...highPan.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  trackWrap: {
    height: 36,
    justifyContent: 'center',
    marginTop: 4,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  fill: {
    position: 'absolute',
    top: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  thumb: {
    position: 'absolute',
    top: 7,
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
});
