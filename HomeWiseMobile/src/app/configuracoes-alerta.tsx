import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { salvarPerfilFirestore } from '@/services/authService';

export default function ConfiguracoesAlertaScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);
  const emAndamento = useRef(false);
  const receberAlertas = perfil?.receber_alertas !== false;

  async function alterarPreferencia(valor: boolean) {
    if (!user || emAndamento.current) return;
    emAndamento.current = true;
    setSalvando(true);
    setMensagem('');
    setErro(false);
    try {
      const salvo = await salvarPerfilFirestore(user.uid, { receber_alertas: valor });
      setErro(!salvo);
      setMensagem(salvo ? 'Preferência salva.' : 'Não foi possível salvar. Tente novamente.');
    } catch {
      setErro(true);
      setMensagem('Não foi possível salvar. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" style={styles.voltar} onPress={() => router.canGoBack() ? router.back() : router.replace('/perfil')}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.titulo} accessibilityRole="header">Configurações de alerta</Text>
        </View>
        <View style={styles.apresentacao}>
          <Ionicons name={receberAlertas ? 'notifications-outline' : 'notifications-off-outline'} size={36} color="#22b7d4" />
          <Text style={styles.titulo}>Seus alertas, sua escolha</Text>
          <Text style={styles.descricao}>Escolha se deseja receber avisos sobre possíveis vazamentos, picos de consumo e instabilidade elétrica no app.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.linha}>
            <View style={styles.textos}>
              <Text style={styles.rotulo}>Receber alertas</Text>
              <Text style={styles.descricao}>{receberAlertas ? 'Alertas ativados' : 'Alertas desativados'}</Text>
            </View>
            <Switch accessibilityLabel="Receber alertas" value={receberAlertas} onValueChange={alterarPreferencia} disabled={salvando || !user || !perfil} trackColor={{ false: '#334155', true: '#0e7490' }} thumbColor={receberAlertas ? '#22d3ee' : '#cbd5e1'} />
          </View>
          <Text style={styles.descricao}>Sua escolha é salva automaticamente na sua conta. Mesmo com os alertas desativados, você pode acompanhar o consumo e os diagnósticos da residência.</Text>
        </View>
        {salvando && <ActivityIndicator color="#22b7d4" accessibilityLabel="Salvando preferência" />}
        {!!mensagem && <Text accessibilityLiveRegion="polite" accessibilityRole={erro ? 'alert' : undefined} style={[styles.feedback, erro && styles.erro]}>{mensagem}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07131b' },
  conteudo: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0e222e', borderWidth: 1, borderColor: '#1e3a4b', justifyContent: 'center', alignItems: 'center' },
  titulo: { color: '#fff', fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
  apresentacao: { alignItems: 'center', gap: 14, paddingVertical: 16 },
  descricao: { color: '#94a3b8', fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: '#0b1d28', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e3a4b', gap: 18 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  textos: { flex: 1, gap: 4 },
  rotulo: { color: '#fff', fontSize: 16, fontWeight: '600' },
  feedback: { color: '#4ade80', fontSize: 14 },
  erro: { color: '#f87171' },
});
