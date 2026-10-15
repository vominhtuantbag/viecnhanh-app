import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/colors';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { hydrateCatalog } from '@/data/catalog';
import { JobsProvider } from '@/context/JobsContext';
import { PushProvider } from '@/context/PushContext';
import { UnreadProvider } from '@/context/UnreadContext';
import PendingReviewGate from '@/components/PendingReviewGate';
import '@/lib/push';

function ResponsiveWebFrame({ children }) {
  const { width } = useWindowDimensions();
  const segments = useSegments();
  const top = segments[0];
  const fullWidth = top === 'admin' || top === 'landing';
  const desktopApp = Platform.OS === 'web' && width >= 1000 && !fullWidth;

  if (!desktopApp) {
    return <View style={styles.frameFill}>{children}</View>;
  }

  return (
    <View style={styles.frameDesk}>
      <View style={styles.frameColumn}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    hydrateCatalog();
  }, []);
  return (
    <AuthProvider>
      <LocationProvider>
      <PushProvider>
        <UnreadProvider>
          <JobsProvider>
            <PendingReviewGate />
            <StatusBar style="dark" />
            <ResponsiveWebFrame>
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
            </ResponsiveWebFrame>
          </JobsProvider>
        </UnreadProvider>
      </PushProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  frameFill: { flex: 1 },
  frameDesk: {
    flex: 1,
    backgroundColor: '#E7EDF6',
    alignItems: 'center',
  },
  frameColumn: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    backgroundColor: Colors.background,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D0D5DD',
  },
});
