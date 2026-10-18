import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddressSearch } from '@/components/AddressSearch';
import { AreaPicker } from '@/components/AreaPicker';
import { AvatarPicker } from '@/components/AvatarPicker';
import { IdentitySection } from '@/components/IdentitySection';
import { MapPinModal } from '@/components/MapPinModal';
import { Colors, Radius, Shadow } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { toAuthErrorMessage } from '@/lib/auth-errors';
import { isPhoneAliasEmail } from '@/lib/phone';
import { saveDetailedPlace } from '@/services/location';

export default function CompleteProfileScreen() {
  const params = useLocalSearchParams();
  const { user, profile, completeProfile, refreshProfile, signOut, isComplete } = useAuth();
  const isEdit = String(params.mode || '') === 'edit';
  const showAddress = isEdit || isComplete;
  const socialLogin = user ? !isPhoneAliasEmail(user.email) : false;

  const [fullName, setFullName] = useState(
    () => profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  );
  const [phone, setPhone] = useState(
    () => profile?.phone || user?.user_metadata?.phone || ''
  );
  const [provinceId, setProvinceId] = useState(() => profile?.province_id || '');
  const [wardId, setWardId] = useState(() => profile?.ward_id || '');
  const [address, setAddress] = useState(() => profile?.address || '');
  const [latitude, setLatitude] = useState(() => profile?.latitude ?? null);
  const [longitude, setLongitude] = useState(() => profile?.longitude ?? null);
  const [avatarOverride, setAvatarOverride] = useState('');
  const avatarUrl = avatarOverride || profile?.avatar_url || '';
  const [locationError, setLocationError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const touchedLocation = useRef(false);
  const touchedAddress = useRef(false);

  useEffect(() => {
    if (touchedLocation.current || !profile?.province_id) return;
    setProvinceId(profile.province_id);
    setWardId(profile.ward_id || '');
  }, [profile?.province_id, profile?.ward_id]);

  useEffect(() => {
    if (touchedAddress.current || !profile?.address) return;
    setAddress(profile.address);
    setLatitude(profile.latitude ?? null);
    setLongitude(profile.longitude ?? null);
  }, [profile?.address, profile?.latitude, profile?.longitude]);

  const title = useMemo(
    () => (isComplete || isEdit ? 'Cập nhật hồ sơ' : 'Hoàn tất hồ sơ để bắt đầu'),
    [isComplete, isEdit]
  );

  async function onSave() {
    setError('');
    if (!provinceId || !wardId) {
      setLocationError(!provinceId ? 'Vui lòng chọn tỉnh/thành.' : 'Vui lòng chọn xã/phường.');
      return;
    }
    setLocationError('');
    setBusy(true);
    try {
      await completeProfile({
        fullName,
        phone,
        provinceId,
        wardId,
        ...(showAddress
          ? {
              address,
              latitude: latitude == null ? undefined : latitude,
              longitude: longitude == null ? undefined : longitude,
            }
          : {}),
      });
      if (isEdit && router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/browse');
      }
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onMapConfirm(place) {
    touchedAddress.current = true;
    setAddress(place.address);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setMapOpen(false);
    if (!user?.id) return;
    const saved = await saveDetailedPlace(user.id, place);
    if (saved) refreshProfile().catch(() => {});
    else setError('Đã điền địa chỉ. Tọa độ chưa lưu được lên hồ sơ.');
  }

  async function onLogout() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      setError(toAuthErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AvatarPicker
            userId={user?.id}
            name={fullName}
            uri={avatarUrl}
            onChange={async (next) => {
              setAvatarOverride(next);
              await refreshProfile().catch(() => {});
            }}
          />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            {socialLogin
              ? 'Bạn đăng nhập bằng Google/Apple. Hãy thêm họ tên, số điện thoại và khu vực thường dùng khi đăng việc.'
              : 'Thêm họ tên và khu vực thường dùng. Số điện thoại đã gắn với tài khoản của bạn.'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Họ & Tên</Text>
            <TextInput
              style={styles.input}
              placeholder="Nguyễn Văn A"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={[styles.input, !socialLogin && profile?.phone ? styles.inputLocked : null]}
              placeholder="0912 345 678"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={socialLogin || !profile?.phone}
            />
            {!socialLogin && profile?.phone ? (
              <Text style={styles.hint}>Số điện thoại dùng để đăng nhập, không đổi tại đây.</Text>
            ) : (
              <Text style={styles.hint}>Dùng số Việt Nam. Người thuê việc sẽ thấy số này.</Text>
            )}

            <Text style={styles.label}>Khu vực mặc định</Text>
            <AreaPicker
              provinceId={provinceId}
              wardId={wardId}
              provinceLabel="Tỉnh / Thành phố"
              wardLabel="Xã / Phường"
              onChange={({ provinceId: nextProvince, wardId: nextWard }) => {
                touchedLocation.current = true;
                setProvinceId(nextProvince);
                setWardId(nextWard);
                setLocationError('');
              }}
            />
            <Text style={styles.hint}>Dùng sẵn khi đăng việc. Bạn vẫn đổi được khu vực trên từng tin.</Text>

            {showAddress ? (
              <>
                <Text style={styles.label}>Địa chỉ chi tiết</Text>
                <AddressSearch
                  value={address}
                  onChangeText={(text) => {
                    touchedAddress.current = true;
                    setAddress(text);
                  }}
                  onPick={(item) => {
                    touchedAddress.current = true;
                    setAddress(item.label);
                    setLatitude(item.latitude);
                    setLongitude(item.longitude);
                  }}
                  onOpenMap={() => setMapOpen(true)}
                />
                <Text style={styles.hint}>
                  Gõ vài chữ để xem gợi ý, hoặc ghim một điểm trên bản đồ. Việc này không đổi tỉnh/xã ở trên.
                </Text>
              </>
            ) : null}
            {locationError ? <Text style={styles.error}>{locationError}</Text> : null}

            <IdentitySection userId={user?.id} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primary, busy && styles.disabled]}
              onPress={onSave}
              disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Lưu và tiếp tục</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={styles.logout} onPress={onLogout} disabled={busy}>
            <Text style={styles.logoutText}>Đăng xuất để dùng tài khoản khác</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {mapOpen ? (
        <MapPinModal
          latitude={latitude}
          longitude={longitude}
          onClose={() => setMapOpen(false)}
          onConfirm={onMapConfirm}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    marginTop: 22,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  inputLocked: {
    color: Colors.textMuted,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  error: {
    marginTop: 12,
    color: '#D92D20',
    fontWeight: '600',
    fontSize: 13,
  },
  primary: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.7,
  },
  logout: {
    marginTop: 20,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
