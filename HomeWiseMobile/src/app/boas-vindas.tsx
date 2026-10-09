import { SafeAreaView } from 'react-native-safe-area-context';
import { Animated, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeWiseLogo from '@/components/HomeWiseLogo';
import { useAuth } from '@/contexts/AuthContext';
import { usePanelMotion } from '@/hooks/use-panel-motion';
import { useState } from 'react';

export default function WelcomeScreen() {
  const { user, selectEntry } = useAuth();
  const panel = usePanelMotion();
  const [transitioning, setTransitioning] = useState(false);
  function enter(mode: 'login' | 'cadastro') {
    if (transitioning) return;
    setTransitioning(true);
    panel.close(() => selectEntry(mode));
  }
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#091321" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <ImageBackground source={require('../../assets/images/welcome-home.png')} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover" accessibilityLabel="Casa sustentável com jardim e painéis solares">
            <View style={styles.shade} />
            <View style={styles.brand}><HomeWiseLogo prominent /><Text style={styles.tagline}>Sua casa. Mais inteligente.</Text></View>
          </ImageBackground>
          <Animated.View style={[styles.panel, panel.style]}>
            <View style={styles.handle} />
            <Text style={styles.eyebrow}>CUIDE DA SUA CASA</Text>
            <Text style={styles.title}>Bem-vindo</Text>
            <Text style={styles.subtitle}>Mais conforto, menos desperdício.{'\n'}Água e energia sob o seu controle.</Text>
            <Animated.View style={[styles.buttonContainer, panel.buttonStyle]}>
            <TouchableOpacity disabled={transitioning} style={styles.primary} accessibilityRole="button" onPressIn={panel.buttonDown} onPressOut={panel.buttonUp} onPress={() => enter('login')}>
              <Text style={styles.primaryText}>{user ? 'Continuar' : 'Entrar'}</Text><Ionicons name="arrow-forward" size={19} color="#fff" />
            </TouchableOpacity>
            </Animated.View>
            {!user && <TouchableOpacity disabled={transitioning} style={styles.secondary} accessibilityRole="button" onPress={() => enter('cadastro')}><Text style={styles.secondaryText}>Criar conta</Text></TouchableOpacity>}
            <View style={styles.footer}><Ionicons name="leaf-outline" size={14} color="#82baff" /><Text style={styles.footerText}>Um novo jeito de viver sua casa.</Text></View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#091321' },
  scroll: { flexGrow: 1 },
  card: { flexGrow: 1, width: '100%', backgroundColor: '#091321' },
  hero: { height: 435, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', paddingTop: 8, paddingBottom: 38 },
  heroImage: { opacity: 0.20 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.10)' },
  brand: { alignItems: 'center', paddingHorizontal: 16 },
  tagline: { color: '#edf4ff', fontSize: 19, fontWeight: '500', lineHeight: 27, letterSpacing: 0.1, marginTop: 10, textAlign: 'center' },
  panel: { flexGrow: 1, backgroundColor: '#101f33', marginTop: -22, paddingHorizontal: 28, paddingTop: 17, paddingBottom: 28, borderTopLeftRadius: 42, borderTopRightRadius: 42, alignItems: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#3d5878', marginBottom: 22 },
  eyebrow: { color: '#82baff', fontSize: 11, letterSpacing: 2.3, fontWeight: '700' },
  title: { color: '#f0f6ff', fontSize: 40, fontWeight: '800', letterSpacing: -1.4, marginTop: 10, textAlign: 'center' },
  subtitle: { color: '#a0b3ce', fontSize: 15, lineHeight: 25, textAlign: 'center', marginTop: 12, marginBottom: 27 },
  primary: { width: '100%', minHeight: 56, borderRadius: 28, backgroundColor: '#2563eb', flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', boxShadow: '0 6px 14px rgba(37, 99, 235, 0.18)' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonContainer: { width: '100%' },
  secondary: { width: '100%', minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: '#29415f', backgroundColor: '#192c45', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  secondaryText: { color: '#c0d1e8', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 25 },
  footerText: { color: '#8b9ab1', fontSize: 11 },
});
