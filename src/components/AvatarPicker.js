import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import { Colors } from '@/constants/colors';
import { initialsFromName } from '@/services/profiles';
import { pickImage, uploadAvatar } from '@/services/uploads';

export function AvatarPicker({ userId, name, uri, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPick() {
    if (!userId || busy) return;
    setError('');
    setBusy(true);
    try {
      const asset = await pickImage({ square: true });
      if (!asset) return;
      const next = await uploadAvatar(userId, asset);
      onChange?.(next);
    } catch (err) {
      setError(err.message || 'Không đổi được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện" onPress={onPick} style={styles.circle}>
        {uri ? (
          <Image source={{ uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <Text style={styles.initials}>{initialsFromName(name)}</Text>
        )}
        <View style={styles.camera}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          )}
        </View>
      </Pressable>
      <Text style={styles.caption}>Ảnh đại diện</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  initials: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  caption: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  error: {
    marginTop: 6,
    color: '#D92D20',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
