import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeWiseLogo from '@/components/HomeWiseLogo';
import { useAuth } from '@/contexts/AuthContext';

export default function WelcomeScreen() {
  const { user, selectEntry } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#eef2f0" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <ImageBackground source={require('../../assets/images/welcome-home.png')} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover" accessibilityLabel="Casa sustentável com jardim e painéis solares">
            <View style={styles.shade} />
            <View style={styles.brand}><HomeWiseLogo prominent /><Text style={styles.tagline}>Sua casa. Mais inteligente.</Text></View>
          </ImageBackground>
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>CUIDE DA SUA CASA</Text>
            <Text style={styles.title}>Bem-vindo</Text>
            <Text style={styles.subtitle}>Mais conforto, menos desperdício.{'\n'}Água e energia sob o seu controle.</Text>
            <TouchableOpacity style={styles.primary} accessibilityRole="button" onPress={() => selectEntry('login')}>
              <Text style={styles.primaryText}>{user ? 'Continuar' : 'Entrar'}</Text><Ionicons name="arrow-forward" size={19} color="#fff" />
            </TouchableOpacity>
            {!user && <TouchableOpacity style={styles.secondary} accessibilityRole="button" onPress={() => selectEntry('cadastro')}><Text style={styles.secondaryText}>Criar conta</Text></TouchableOpacity>}
            <View style={styles.footer}><Ionicons name="leaf-outline" size={14} color="#568375" /><Text style={styles.footerText}>Um novo jeito de viver sua casa.</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f0' },
  scroll: { flexGrow: 1, padding: 16, justifyContent: 'center' },
  card: { width: '100%', maxWidth: 430, alignSelf: 'center', borderRadius: 36, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e9e4', boxShadow: '0 16px 44px rgba(27, 45, 38, 0.14)' },
  hero: { height: 435, backgroundColor: '#18352c', justifyContent: 'center', alignItems: 'center', paddingTop: 8, paddingBottom: 38 },
  heroImage: { opacity: 0.20 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13, 27, 23, 0.10)' },
  brand: { alignItems: 'center', paddingHorizontal: 16 },
  tagline: { color: '#edf5f0', fontSize: 19, fontWeight: '500', lineHeight: 27, letterSpacing: 0.1, marginTop: 10, textAlign: 'center' },
  panel: { backgroundColor: '#fff', marginTop: -46, paddingHorizontal: 28, paddingTop: 34, paddingBottom: 28, borderTopLeftRadius: 58, borderTopRightRadius: 58, alignItems: 'center' },
  eyebrow: { color: '#568375', fontSize: 11, letterSpacing: 2.3, fontWeight: '700' },
  title: { color: '#233b2f', fontSize: 40, fontWeight: '800', letterSpacing: -1.4, marginTop: 10, textAlign: 'center' },
  subtitle: { color: '#728078', fontSize: 15, lineHeight: 25, textAlign: 'center', marginTop: 12, marginBottom: 27 },
  primary: { width: '100%', minHeight: 56, borderRadius: 28, backgroundColor: '#244c3d', flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', boxShadow: '0 6px 14px rgba(36, 76, 61, 0.18)' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { width: '100%', minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: '#dce3df', backgroundColor: '#f8faf8', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  secondaryText: { color: '#354d3f', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 25 },
  footerText: { color: '#8b9690', fontSize: 11 },
});
