import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { planos, type Plano } from '@/constants/planos';
import { PlanBenefits, PlanPrice, SubscriptionScreen, subscriptionStyles as s } from '@/components/SubscriptionUI';

export default function GerenciarAssinaturaScreen() {
  const router = useRouter();
  const [selecionado, setSelecionado] = useState<Plano | null>(null);

  return (
    <SubscriptionScreen title="Gerenciar assinatura" onBack={() => router.replace('/plano-assinatura')}>
      <Text style={s.eyebrow}>PLANOS HOMEWISE</Text>
      <Text style={s.title}>O plano certo para sua casa.</Text>
      <Text style={s.subtitle}>Planos flexíveis para diferentes necessidades. Economize mais, pague menos.</Text>
      <View style={styles.current}><View style={s.icon}><Ionicons name="layers-outline" size={22} color="#76d7cd" /></View><View style={styles.currentText}><Text style={styles.currentLabel}>SUA ASSINATURA</Text><Text style={styles.currentName}>Sem plano contratado</Text></View></View>
      <View style={styles.list}>
        {planos.map(plano => (
          <View key={plano.id} style={[s.card, plano.id === 'plus' && s.featured]}>
            <View style={s.cardTop}><View style={s.icon}><Ionicons name={plano.icone} size={24} color="#76d7cd" /></View>{plano.id === 'plus' && <View style={s.badge}><Text style={s.badgeText}>MAIS ESCOLHIDO</Text></View>}</View>
            <Text style={s.planName}>{plano.nome}</Text>
            <Text style={s.description}>{plano.descricao}</Text>
            <PlanPrice value={plano.preco} />
            <View style={s.divider} />
            <PlanBenefits items={plano.beneficios} />
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Escolher plano ${plano.nome}`} style={plano.id === 'plus' ? s.primary : s.secondary} onPress={() => setSelecionado(plano)}><Text style={plano.id === 'plus' ? s.primaryText : s.secondaryText}>Escolher plano</Text></TouchableOpacity>
          </View>
        ))}
      </View>
      <View style={s.note}><Ionicons name="information-circle-outline" size={18} color="#8fa6b3" /><Text style={s.noteText}>Valores mensais. A escolha de um plano permite consultar seus detalhes e não realiza cobranças.</Text></View>
      <Modal transparent animationType="fade" visible={!!selecionado} onRequestClose={() => setSelecionado(null)}>
        <View style={styles.overlay}><View style={[s.card, styles.modal]} accessibilityViewIsModal>
          <Text style={s.eyebrow}>DETALHES DO PLANO</Text>
          <Text accessibilityRole="header" style={s.planName}>HomeWise {selecionado?.nome}</Text>
          {selecionado && <PlanPrice value={selecionado.preco} />}
          <Text style={s.description}>A contratação e a troca de planos ainda não estão disponíveis. Nenhuma alteração foi feita na sua assinatura.</Text>
          <TouchableOpacity accessibilityRole="button" style={[s.primary, styles.close]} onPress={() => setSelecionado(null)}><Text style={s.primaryText}>Entendi</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SubscriptionScreen>
  );
}

const styles = StyleSheet.create({
  current: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#0b1d28', borderRadius: 16, borderWidth: 1, borderColor: '#1e3a4b', padding: 16, marginBottom: 24 },
  currentText: { flex: 1 },
  currentLabel: { fontSize: 9, color: '#85a9b8', fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  currentName: { color: '#e8f2f5', fontSize: 16, fontWeight: '600' },
  list: { gap: 20 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' },
  modal: { width: '100%', maxWidth: 420 },
  close: { marginTop: 24 },
});
