import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

function storageMessage(error) {
  const text = error?.message || '';
  if (/bucket|not found|schema|row-level|403|401/i.test(text)) {
    return 'Chưa lưu được ảnh. Hãy chạy file SQL xác minh một lần trong Supabase.';
  }
  return text || 'Không tải ảnh lên được.';
}

export async function pickImage({ square = false } = {}) {
  if (Platform.OS !== 'web') {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.status !== 'granted') {
      const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!asked.granted) {
        throw new Error('Bạn chưa cho phép chọn ảnh.');
      }
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: square,
    aspect: square ? [1, 1] : [4, 3],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

async function fileBody(asset) {
  if (asset.file) return asset.file;
  const response = await fetch(asset.uri);
  return response.arrayBuffer();
}

export async function uploadAvatar(userId, asset) {
  const contentType = asset.mimeType || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const uploaded = await supabase.storage.from('avatars').upload(path, await fileBody(asset), {
    contentType,
    upsert: true,
  });
  if (uploaded.error) throw new Error(storageMessage(uploaded.error));
  const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;
  const saved = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
  if (saved.error) throw new Error(saved.error.message || 'Không lưu được ảnh đại diện.');
  return avatarUrl;
}

export async function uploadVerificationPhoto(userId, requirementId, side, asset) {
  const contentType = asset.mimeType || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${requirementId}/${side}.${ext}`;
  const uploaded = await supabase.storage.from('verification_docs').upload(path, await fileBody(asset), {
    contentType,
    upsert: true,
  });
  if (uploaded.error) throw new Error(storageMessage(uploaded.error));
  return path;
}

export async function signedDocUrl(path) {
  if (!path) return '';
  const signed = await supabase.storage.from('verification_docs').createSignedUrl(path, 60 * 30);
  if (signed.error) return '';
  return signed.data?.signedUrl || '';
}
