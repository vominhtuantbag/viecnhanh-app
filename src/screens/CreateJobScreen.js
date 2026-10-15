import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { AreaPicker } from '@/components/AreaPicker';
import { Colors, Radius } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useJobs } from '@/context/JobsContext';
import { useLocation } from '@/context/LocationContext';
import { getCategoryById } from '@/data/categories';
import { useCatalog, visibleSubs } from '@/data/catalog';
import { areaFromCoordinates, coordinatesForArea } from '@/services/geo';

export default function CreateJobScreen() {
  const params = useLocalSearchParams();
  const { session, loading: authLoading, isComplete } = useAuth();
  const { addJob } = useJobs();
  const { ensureLocation } = useLocation();
  const [title, setTitle] = useState(() => String(params.title || ''));
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [wardId, setWardId] = useState('');
  const [gps, setGps] = useState(null);
  const [placeNote, setPlaceNote] = useState('Đang lấy vị trí để điền tỉnh và xã...');
  const [submitting, setSubmitting] = useState(false);
  const edited = useRef(false);
  const placeStarted = useRef(false);
  const catalog = useCatalog();
  const [categoryId, setCategoryId] = useState(() => String(params.categoryId || ''));
  const category = getCategoryById(categoryId);
  const parentId = category?.parentId || categoryId;
  const subs = parentId
    ? visibleSubs(catalog).filter((item) => item.parentId === parentId)
    : [];

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace({ pathname: '/(auth)/login', params: { redirect: '/create' } });
    } else if (!isComplete) {
      router.replace('/(auth)/complete-profile');
    }
  }, [authLoading, isComplete, session]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (placeStarted.current) return;
      placeStarted.current = true;
      (async () => {
        try {
          const here = await ensureLocation();
          if (cancelled) return;
          if (!here) {
            setPlaceNote('Chưa lấy được vị trí. Bạn vẫn chọn tỉnh và xã bên dưới.');
            return;
          }
          setGps(here);
          const area = await areaFromCoordinates(here);
          if (cancelled || edited.current) return;
          if (area?.provinceId) {
            setProvinceId(area.provinceId);
            setWardId(area.wardId || '');
            setPlaceNote(
              area.wardId
                ? 'Đã điền theo vị trí hiện tại. Bạn có thể chọn chỗ khác.'
                : 'Đã tìm thấy tỉnh. Hãy kiểm tra lại xã/phường.'
            );
          } else {
            setPlaceNote('Chưa nhận ra khu vực. Hãy chọn tỉnh và xã.');
          }
        } catch {
          if (!cancelled) setPlaceNote('Chưa lấy được vị trí. Bạn vẫn chọn tỉnh và xã bên dưới.');
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ensureLocation]);

  async function useMyLocation() {
    edited.current = false;
    setPlaceNote('Đang lấy vị trí...');
    const here = await ensureLocation();
    if (!here) {
      setPlaceNote('Chưa lấy được vị trí. Hãy bật định vị rồi thử lại, hoặc chọn tay.');
      return;
    }
    setGps(here);
    try {
      const area = await areaFromCoordinates(here);
      if (edited.current) return;
      if (area?.provinceId) {
        setProvinceId(area.provinceId);
        setWardId(area.wardId || '');
        setPlaceNote('Đã điền theo vị trí hiện tại. Bạn có thể chọn chỗ khác.');
      }
    } catch {
      setPlaceNote('Có vị trí nhưng chưa tra được tên khu vực. Hãy chọn tay.');
    }
  }

  async function submit() {
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mức giá.');
      return;
    }
    if (!provinceId || !wardId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn khu vực.');
      return;
    }

    setSubmitting(true);
    try {
      let latitude = null;
      let longitude = null;
      if (!edited.current && gps) {
        latitude = gps.latitude;
        longitude = gps.longitude;
      } else {
        try {
          const spot = await coordinatesForArea(provinceId, wardId);
          if (spot) {
            latitude = spot.latitude;
            longitude = spot.longitude;
          }
        } catch {
          // Vẫn đăng tin nếu chưa tra được tọa độ của khu vực chọn tay.
        }
      }
      const job = await addJob({
        title,
        description,
        price,
        provinceId,
        wardId,
        categoryId,
        latitude,
        longitude,
      });
      const pending = !job.isApproved || job.status === 'pending';
      Alert.alert(
        pending ? 'Đã gửi tin, chờ duyệt' : 'Đăng việc thành công',
        pending
          ? 'Bạn đang có tin Đang mở nên tin này cần được duyệt trước khi hiện trên Khám phá.'
          : 'Tin đã được duyệt và xuất hiện trên Khám phá.',
        [
          pending
            ? { text: 'Việc của tôi', onPress: () => router.replace('/(tabs)/my-tasks') }
            : { text: 'Xem tin', onPress: () => router.replace(`/job/${job.id}`) },
        ]
      );
    } catch (err) {
      if (err.code === 'AUTH_REQUIRED') {
        router.replace({ pathname: '/(auth)/login', params: { redirect: '/create' } });
        return;
      }
      Alert.alert('Không đăng được tin', err.message ?? 'Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {category && category.status !== 'hide' ? (
            <Text style={styles.category}>Danh mục: {category.name}</Text>
          ) : null}
          {subs.length ? (
            <>
              <Text style={styles.label}>Danh mục con</Text>
              <View style={styles.chips}>
                {subs.map((item) => {
                  const on = categoryId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setCategoryId(item.id)}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={styles.label}>Tiêu đề</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: Sửa ống nước nhà bếp"
            placeholderTextColor={Colors.textLight}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Mô tả ngắn gọn: bạn cần làm gì?"
            placeholderTextColor={Colors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Ngân sách (VNĐ)</Text>
          <TextInput
            style={styles.input}
            placeholder="350000"
            placeholderTextColor={Colors.textLight}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Khu vực</Text>
          <Text style={styles.placeNote}>{placeNote}</Text>
          <AreaPicker
            provinceId={provinceId}
            wardId={wardId}
            onChange={({ provinceId: nextProvince, wardId: nextWard }) => {
              edited.current = true;
              setProvinceId(nextProvince);
              setWardId(nextWard);
              setPlaceNote('Bạn đang chọn khu vực khác. Tin sẽ gắn với chỗ này.');
            }}
          />
          <Pressable onPress={useMyLocation}>
            <Text style={styles.relocate}>Dùng vị trí hiện tại</Text>
          </Pressable>

          <Pressable style={[styles.submit, submitting && styles.submitDisabled]} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Đăng việc</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },
  category: {
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.text,
    fontWeight: '700',
  },
  chipTextOn: {
    color: Colors.primary,
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  placeNote: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  relocate: {
    marginTop: 8,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 22,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  submitDisabled: {
    opacity: 0.7,
  },
});
