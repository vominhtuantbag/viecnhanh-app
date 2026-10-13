import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { Colors } from '@/constants/colors';
import { DEFAULT_HOME, useAuth } from '@/context/AuthContext';

export default function AuthCallback() {
  const { session, loading, isComplete } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!isComplete) return <Redirect href="/(auth)/complete-profile" />;
  return <Redirect href={DEFAULT_HOME} />;
}
