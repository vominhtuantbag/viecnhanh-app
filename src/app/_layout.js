import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/colors';
import { AuthProvider } from '@/context/AuthContext';
import { JobsProvider } from '@/context/JobsContext';
import { PushProvider } from '@/context/PushContext';
import { UnreadProvider } from '@/context/UnreadContext';
import PendingReviewGate from '@/components/PendingReviewGate';
import '@/lib/push';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PushProvider>
        <UnreadProvider>
          <JobsProvider>
            <PendingReviewGate />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerTintColor: Colors.text,
                headerTitleStyle: { fontWeight: '800' },
                headerStyle: { backgroundColor: Colors.surface },
                contentStyle: { backgroundColor: Colors.background },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="landing" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
              <Stack.Screen name="create" options={{ title: 'Đăng việc mới' }} />
              <Stack.Screen name="job/[id]" options={{ title: 'Chi tiết công việc' }} />
              <Stack.Screen name="user/[id]" options={{ title: 'Hồ sơ người dùng' }} />
              <Stack.Screen name="chat/[id]" options={{ title: 'Chat / Gọi điện' }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
            </Stack>
          </JobsProvider>
        </UnreadProvider>
      </PushProvider>
    </AuthProvider>
  );
}
