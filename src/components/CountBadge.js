import { StyleSheet, Text, View } from 'react-native';

import { badgeLabel } from '@/services/unread';

export function CountBadge({ count }) {
  const label = badgeLabel(count);
  if (!label) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
