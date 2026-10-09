import { Stack } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import HomeWiseTabBar from '@/components/HomeWiseTabBar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export default function RootLayout() {
  return <AuthProvider><Navigation /></AuthProvider>;
}

function Navigation() {
  const { user, loading, entry } = useAuth();
  if (loading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#22b7d4" size="large" /></View>;
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#07131b' },
          animation: 'fade'
        }}
      >
        <Stack.Protected guard={!entry}>
          <Stack.Screen name="boas-vindas" />
        </Stack.Protected>
        <Stack.Protected guard={!user && !!entry}>
          <Stack.Screen name={entry === 'cadastro' ? 'cadastro' : 'login'} />
          <Stack.Screen name={entry === 'cadastro' ? 'login' : 'cadastro'} />
          <Stack.Screen name="recuperar-senha" />
        </Stack.Protected>
        <Stack.Protected guard={!!user && !!entry}>
          <Stack.Screen name="index" />
          <Stack.Screen name="agua" />
          <Stack.Screen name="energia" />
          <Stack.Screen name="alertas" />
          <Stack.Screen name="perfil" />
        </Stack.Protected>
      </Stack>
      {user && entry && <HomeWiseTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  }
});
