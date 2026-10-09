import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import HomeWiseTabBar from '@/components/HomeWiseTabBar';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#07131b' },
          animation: 'fade'
        }}
      />
      <HomeWiseTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  }
});
