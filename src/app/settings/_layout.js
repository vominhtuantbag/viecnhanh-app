import { Stack } from 'expo-router';

import { Colors } from '@/constants/colors';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerStyle: { backgroundColor: Colors.surface },
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="skills" options={{ title: 'Thành tựu' }} />
      <Stack.Screen name="payments" options={{ title: 'Phương thức thanh toán' }} />
      <Stack.Screen name="notifications" options={{ title: 'Tùy chọn thông báo' }} />
      <Stack.Screen name="job-alerts" options={{ title: 'Thông báo việc làm' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Bảng điều khiển của tôi' }} />
      <Stack.Screen name="quests" options={{ title: 'Nhiệm vụ & Nhận quà' }} />
      <Stack.Screen name="referral" options={{ title: 'Mời bạn bè & Mã giảm giá' }} />
    </Stack>
  );
}
