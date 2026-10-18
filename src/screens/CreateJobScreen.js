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
import { tasksForSubcategory, useCatalog, visibleMains, visibleSubs } from '@/data/catalog';
import { areaFromCoordinates, coordinatesForArea } from '@/services/geo';

const EMPTY_ERRORS = {
  category: '',
  tasks: '',
  price: '',
  province: '',
  ward: '',
};

function taskSummary(names) {
  if (!names.length) return '';
  return `Cần thực hiện các công việc: ${names.join(', ')}.`;
}

function budgetAmount(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return NaN;
  return Number(digits);
}

export default function CreateJobScreen() {
  const params = useLocalSearchParams();
  const { session, profile, loading: authLoading, isComplete } = useAuth();
  const { addJob } = useJobs();
  const { ensureLocation } = useLocation();
  const catalog = useCatalog();
  const incoming = getCategoryById(String(params.categoryId || ''));
  const incomingIsSub = Boolean(incoming?.parentId);
  const [mainId, setMainId] = useState(() =>
    incomingIsSub ? incoming.parentId : String(params.categoryId || '')
  );
  const [subId, setSubId] = useState(() => (incomingIsSub ? incoming.id : ''));
  const [openedWithCategory] = useState(() => Boolean(String(params.categoryId || '')));
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [formError, setFormError] = useState('');
  const [provinceId, setProvinceId] = useState(() => profile?.province_id || '');
  const [wardId, setWardId] = useState(() => profile?.ward_id || '');
  const [gps, setGps] = useState(null);
  const [placeNote, setPlaceNote] = useState(() =>
    profile?.province_id
      ? 'Đã điền theo khu vực trong hồ sơ. Bạn có thể chọn chỗ khác cho tin này.'
      : 'Đang lấy vị trí để điền tỉnh và xã...'
  );
  const [submitting, setSubmitting] = useState(false);
  const edited = useRef(false);
  const placeStarted = useRef(false);
  const placeLocked = useRef(false);
  const profilePlace = useRef(Boolean(profile?.province_id));
  const mains = visibleMains(catalog);
  const subs = mainId ? visibleSubs(catalog).filter((item) => item.parentId === mainId) : [];
  const selectedSub = subs.find((item) => item.id === subId) || null;
  const main = mains.find((item) => item.id === mainId) || getCategoryById(mainId);
  const title = selectedSub?.name || (mainId && !subs.length ? main?.name || '' : '');
  const relatedTasks = tasksForSubcategory(subId, catalog);
  const selectedNames = relatedTasks
    .filter((task) => selectedTaskIds.includes(task.id))
    .map((task) => task.name);
  const description = taskSummary(selectedNames);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace({ pathname: '/(auth)/login', params: { redirect: '/create' } });
    } else if (!isComplete) {
      router.replace('/(auth)/complete-profile');
    }
  }, [authLoading, isComplete, session]);

  useEffect(() => {
    if (!profile?.province_id) return;
    profilePlace.current = true;
    if (edited.current || placeLocked.current) return;
    setProvinceId(profile.province_id);
    setWardId(profile.ward_id || '');
    setGps(null);
    setPlaceNote('Đã điền theo khu vực trong hồ sơ. Bạn có thể chọn chỗ khác cho tin này.');
  }, [profile?.province_id, profile?.ward_id]);

  useEffect(() => {
    if (profilePlace.current) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (placeStarted.current || profilePlace.current) return;
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
          if (cancelled || edited.current || profilePlace.current) return;
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
  }, [ensureLocation, profile?.province_id]);

  async function useMyLocation() {
    placeLocked.current = true;
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

  function pickMain(item) {
    if (item.id === mainId) return;
    setMainId(item.id);
    setSubId('');
    setSelectedTaskIds([]);
    setErrors((current) => ({ ...current, category: '', tasks: '' }));
  }

  function pickSub(item) {
    if (item.id === subId) return;
    setSubId(item.id);
    setSelectedTaskIds([]);
    setErrors((current) => ({ ...current, category: '', tasks: '' }));
  }

  function toggleTask(taskId) {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
    setErrors((current) => ({ ...current, tasks: '' }));
  }

  function validate() {
    const next = { ...EMPTY_ERRORS };
    const amount = budgetAmount(price);
    if (subs.length && !subId) next.category = 'Vui lòng chọn loại việc.';
    else if (!title.trim()) next.category = 'Vui lòng chọn nhóm việc.';
    if (relatedTasks.length && selectedNames.length === 0) next.tasks = 'Vui lòng chọn ít nhất 1 việc';
    if (!Number.isFinite(amount) || amount <= 0) next.price = 'Vui lòng nhập ngân sách hợp lệ';
    if (!provinceId) next.province = 'Vui lòng chọn tỉnh/thành';
    if (!wardId) next.ward = 'Vui lòng chọn xã/phường';
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submit() {
    setFormError('');
    if (!validate()) return;

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
        description: description || taskSummary([title]),
        price: String(budgetAmount(price)),
        provinceId,
        wardId,
        categoryId: subId || mainId,
        latitude,
        longitude,
      });
      const pending = !job?.isApproved || job?.status === 'pending';
      const goMine = () => router.replace('/(tabs)/my-tasks');
      Alert.alert(
        pending ? 'Đã gửi tin, chờ duyệt' : 'Đăng việc thành công',
        pending
          ? 'Tin này cần được duyệt trước khi hiện trên Khám phá.'
          : 'Tin đã được gửi và xuất hiện trên Khám phá.',
        [{ text: 'Việc của tôi', onPress: goMine }]
      );
      if (Platform.OS === 'web') goMine();
    } catch (err) {
      console.log('Post job error:', err);
      if (err.code === 'AUTH_REQUIRED') {
        router.replace({ pathname: '/(auth)/login', params: { redirect: '/create' } });
        return;
      }
      const message = err.message ?? 'Vui lòng thử lại.';
      setFormError(message);
      Alert.alert('Không đăng được tin', message);
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
          {!openedWithCategory ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipRow}>
              {mains.map((item) => {
                const on = mainId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => pickMain(item)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {errors.category && !subs.length ? <Text style={styles.errorText}>{errors.category}</Text> : null}
          {subs.length ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipRow}>
              {subs.map((item) => {
                const on = subId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => pickSub(item)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {errors.category && subs.length ? <Text style={styles.errorText}>{errors.category}</Text> : null}
          <Text style={styles.label}>Tiêu đề</Text>
          <TextInput
            style={[styles.input, styles.inputLocked]}
            placeholder="Chọn mục phía trên"
            placeholderTextColor={Colors.textLight}
            value={title}
            editable={false}
          />

          {relatedTasks.length ? (
            <>
              <Text style={styles.label}>Chọn 1 hoặc nhiều việc</Text>
              <View style={styles.chips}>
                {relatedTasks.map((item) => {
                  const on = selectedTaskIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleTask(item.id)}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          {errors.tasks ? <Text style={styles.errorText}>{errors.tasks}</Text> : null}
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, styles.inputLocked, styles.multiline]}
            placeholder="Nội dung hiện khi bạn chọn việc"
            placeholderTextColor={Colors.textLight}
            value={description}
            editable={false}
            multiline
          />

          <Text style={styles.label}>Ngân sách (VNĐ)</Text>
          <TextInput
            style={[styles.input, errors.price && styles.inputError]}
            placeholder="350000"
            placeholderTextColor={Colors.textLight}
            value={price}
            onChangeText={(value) => {
              setPrice(value);
              if (errors.price) setErrors((current) => ({ ...current, price: '' }));
            }}
            keyboardType="numeric"
          />
          {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}

          <Text style={styles.label}>Khu vực</Text>
          <Text style={styles.placeNote}>{placeNote}</Text>
          <AreaPicker
            provinceId={provinceId}
            wardId={wardId}
            onChange={({ provinceId: nextProvince, wardId: nextWard }) => {
              placeLocked.current = true;
              edited.current = true;
              setProvinceId(nextProvince);
              setWardId(nextWard);
              setPlaceNote('Bạn đang chọn khu vực khác. Tin sẽ gắn với chỗ này.');
              setErrors((current) => ({
                ...current,
                province: nextProvince ? '' : current.province,
                ward: nextWard ? '' : current.ward,
              }));
            }}
          />
          {errors.province ? <Text style={styles.errorText}>{errors.province}</Text> : null}
          {errors.ward ? <Text style={styles.errorText}>{errors.ward}</Text> : null}
          <Pressable onPress={useMyLocation}>
            <Text style={styles.relocate}>Dùng vị trí hiện tại</Text>
          </Pressable>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
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
  chipScroller: {
    flexGrow: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
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
  inputLocked: {
    backgroundColor: Colors.assignedSoft,
    color: Colors.text,
  },
  inputError: {
    borderColor: '#D92D20',
  },
  errorText: {
    color: '#D92D20',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
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
