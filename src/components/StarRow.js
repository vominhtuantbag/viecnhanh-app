import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function StarRow({ rating, size = 13, onChange }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <View style={[styles.stars, onChange && styles.starsInteractive]}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;
        const half = !filled && value >= star - 0.75;
        const icon = (
          <Ionicons
            name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
            size={size}
            color="#F79009"
          />
        );
        if (!onChange) {
          return <View key={star}>{icon}</View>;
        }
        return (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  starsInteractive: {
    gap: 8,
  },
});
