import { Stack } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import HomeWiseTabBar from '@/components/HomeWiseTabBar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export default function RootLayout() {
  return <AuthProvider><Navigation /></AuthProvider>;
}

function Navigation() {
  const { user, loading, entry, perfilConcluido } = useAuth();
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
        <Stack.Protected guard={!user && !entry}>
          <Stack.Screen name="boas-vindas" />
        </Stack.Protected>
        <Stack.Protected guard={!perfilConcluido && (!!user || entry === 'cadastro')}>
          <Stack.Screen name="cadastro" />
        </Stack.Protected>
        <Stack.Protected guard={!user && entry === 'login'}>
          <Stack.Screen name="login" />
          <Stack.Screen name="recuperar-senha" />
        </Stack.Protected>
        <Stack.Protected guard={perfilConcluido}>
          <Stack.Screen name="index" />
          <Stack.Screen name="agua" />
          <Stack.Screen name="energia" />
          <Stack.Screen name="alertas" />
          <Stack.Screen name="perfil" />
          <Stack.Screen name="metas" />
          <Stack.Screen name="editar-perfil" />
          <Stack.Screen name="alterar-senha" />
          <Stack.Screen name="plano-assinatura" />
          <Stack.Screen name="gerenciar-assinatura" />
          <Stack.Screen name="painel-admin" />
          <Stack.Screen name="escanear-qrcode" options={{ animation: 'slide_from_bottom' }} />
        </Stack.Protected>
      </Stack>
      {perfilConcluido && <HomeWiseTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  }
});
