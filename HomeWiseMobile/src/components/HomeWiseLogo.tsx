import { Image, StyleSheet, Text, View } from 'react-native';

export default function HomeWiseLogo({ compact = false, prominent = false }: { compact?: boolean; prominent?: boolean }) {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/logo homewise.png')} style={[compact ? styles.smallLogo : styles.logo, prominent && styles.prominentLogo]} resizeMode="contain" accessibilityLabel="Logo HomeWise" />
      {!compact && <Text style={[styles.brand, prominent && styles.prominentBrand]}>Home<Text style={styles.accent}>Wise</Text></Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  logo: { width: 106, height: 118 },
  smallLogo: { width: 50, height: 56 },
  prominentLogo: { width: 205, height: 228 },
  prominentBrand: { fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 10 },
  brand: { color: '#f5f7ff', fontSize: 27, fontWeight: '600', marginTop: 12 },
  accent: { color: '#58b8f3' },
});
