import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Colors, Radius } from '@/constants/colors';
import {
  VERIFICATION_SEED,
  fetchMyVerification,
  overallStatus,
  slotsFor,
  statusLabel,
  submitVerificationPhoto,
} from '@/services/verification';
import { pickImage } from '@/services/uploads';

const SIDE_LABEL = { front: 'Mặt trước', back: 'Mặt sau' };

const BADGE = {
  missing: { color: '#667085', bg: '#F2F4F7' },
  pending: { color: '#B54708', bg: '#FFFAEB' },
  approved: { color: '#027A48', bg: '#ECFDF3' },
  rejected: { color: '#B42318', bg: '#FEF3F2' },
};

export function IdentitySection({ userId }) {
  const [requirements, setRequirements] = useState(VERIFICATION_SEED);
  const [documents, setDocuments] = useState([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    fetchMyVerification(userId)
      .then((data) => {
        if (!alive) return;
        setRequirements(data.requirements);
        setDocuments(data.documents);
        setOffline(data.offline);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Không tải được giấy tờ.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  async function onUpload(requirement, side) {
    if (!userId) {
      setError('Hãy đăng nhập trước khi gửi giấy tờ.');
      return;
    }
    if (busyKey) return;
    setError('');
    setBusyKey(`${requirement.id}-${side}`);
    try {
      const asset = await pickImage();
      if (!asset) return;
      const saved = await submitVerificationPhoto(userId, requirement.id, side, asset);
      setDocuments((current) => {
        const rest = current.filter(
          (item) => !(item.requirement_id === requirement.id && item.side === side)
        );
        return [...rest, saved];
      });
      setOffline(false);
    } catch (err) {
      setError(err.message || 'Không gửi được ảnh giấy tờ.');
    } finally {
      setBusyKey('');
    }
  }

  const status = overallStatus(requirements, documents);
  const badge = BADGE[status] || BADGE.missing;

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.title}>Xác minh danh tính</Text>
        <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.bg }]}>{statusLabel(status)}</Text>
      </View>
      <Text style={styles.note}>
        Gửi ảnh rõ, đủ sáng. Chỉ những giấy tờ đang bật và bắt buộc mới được đưa vào hàng chờ duyệt.
      </Text>
      {offline ? (
        <Text style={styles.warn}>Máy chủ chưa có bảng giấy tờ. Ảnh sẽ lưu được sau khi chạy file SQL một lần.</Text>
      ) : null}
      {loading ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : null}
      {requirements.map((requirement) => (
        <View key={requirement.id} style={styles.card}>
          <Text style={styles.cardTitle}>{requirement.title}</Text>
          {requirement.is_required ? <Text style={styles.required}>Bắt buộc</Text> : <Text style={styles.optional}>Không bắt buộc</Text>}
          <View style={styles.sides}>
            {slotsFor(requirement).map((side) => {
              const doc = documents.find(
                (item) => item.requirement_id === requirement.id && item.side === side
              );
              const busy = busyKey === `${requirement.id}-${side}`;
              return (
                <Pressable key={side} style={styles.side} onPress={() => onUpload(requirement, side)} disabled={busy}>
                  {doc?.previewUrl ? (
                    <Image source={{ uri: doc.previewUrl }} style={styles.preview} contentFit="cover" />
                  ) : (
                    <Text style={styles.plus}>+</Text>
                  )}
                  <Text style={styles.sideLabel}>{busy ? 'Đang gửi...' : SIDE_LABEL[side]}</Text>
                  {doc?.status === 'rejected' && doc.reject_reason ? (
                    <Text style={styles.reject} numberOfLines={2}>
                      {doc.reject_reason}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  note: {
    marginTop: 6,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  warn: {
    marginTop: 8,
    color: '#B54708',
    fontSize: 12,
    lineHeight: 17,
  },
  loader: {
    marginTop: 12,
  },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    backgroundColor: Colors.background,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  required: {
    marginTop: 2,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  optional: {
    marginTop: 2,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sides: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  side: {
    flex: 1,
    minHeight: 110,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  preview: {
    width: '100%',
    height: 72,
    borderRadius: 8,
  },
  plus: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  sideLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  reject: {
    marginTop: 4,
    fontSize: 11,
    color: '#B42318',
    textAlign: 'center',
  },
  error: {
    marginTop: 10,
    color: '#D92D20',
    fontWeight: '600',
    fontSize: 13,
  },
});
