import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HomeWiseLogo from '@/components/HomeWiseLogo';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <HomeWiseLogo />
          <Text style={styles.title}>Inteligência para{ '\n' }economizar</Text>
          <Text style={styles.subtitle}>Sua casa conectada a um futuro mais sustentável.</Text>
          <Link href="/login" style={styles.button}>Entrar</Link>
          <Link href="/cadastro" style={styles.link}>Criar minha conta</Link>
          <View style={styles.emblem}><Text style={styles.emblemText}>100%</Text><Text style={styles.emblemLabel}>conectado</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191e2a' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 36 },
  content: { maxWidth: 360, width: '100%', alignSelf: 'center', alignItems: 'center' },
  title: { color: '#fff', textAlign: 'center', fontSize: 21, fontWeight: '600', marginTop: 28, lineHeight: 30 },
  subtitle: { color: '#a9b3c5', textAlign: 'center', fontSize: 13, lineHeight: 21, marginTop: 12, marginBottom: 26 },
  button: { color: '#fff', backgroundColor: '#254e88', textAlign: 'center', width: '100%', paddingVertical: 16, borderRadius: 7, overflow: 'hidden', fontWeight: '600' },
  link: { color: '#7cbfff', paddingVertical: 20, fontSize: 13 },
  emblem: { width: 94, height: 94, borderRadius: 47, borderWidth: 4, borderColor: '#2674ed', borderRightColor: '#58b8f3', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  emblemText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emblemLabel: { color: '#a9b3c5', fontSize: 10, marginTop: 3 },
});
