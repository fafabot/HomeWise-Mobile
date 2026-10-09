import { Image, StyleSheet, Text, View } from 'react-native';

export default function HomeWiseLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/logo homewise.png')} style={compact ? styles.smallLogo : styles.logo} resizeMode="contain" accessibilityLabel="Logo HomeWise" />
      {!compact && <Text style={styles.brand}>Home<Text style={styles.accent}>Wise</Text></Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  logo: { width: 106, height: 118 },
  smallLogo: { width: 50, height: 56 },
  brand: { color: '#f5f7ff', fontSize: 27, fontWeight: '600', marginTop: 12 },
  accent: { color: '#58b8f3' },
});
