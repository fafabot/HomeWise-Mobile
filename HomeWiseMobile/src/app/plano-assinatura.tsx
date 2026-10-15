import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { planos } from '@/constants/planos';
import { PlanBenefits, PlanPrice, SubscriptionScreen, subscriptionStyles as s } from '@/components/SubscriptionUI';

export default function PlanoAssinaturaScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const nome = (perfil?.nome || user?.displayName || user?.email?.split('@')[0] || 'você').split(' ')[0];

  return (
    <SubscriptionScreen title="Plano e assinatura" onBack={() => router.replace('/perfil')}>
      <Text style={s.eyebrow}>SEU HOMEWISE</Text>
      <Text style={s.title}>Mais controle para sua casa.</Text>
      <Text style={s.subtitle}>Olá, {nome}. Você ainda não tem um plano contratado. Conheça as opções para sua casa.</Text>
      <View style={[s.card, s.featured]}>
        <View style={s.cardTop}><View style={s.icon}><Ionicons name="layers-outline" size={24} color="#76d7cd" /></View><View style={s.badge}><Text style={s.badgeText}>SEM PLANO</Text></View></View>
        <Text style={s.planName}>Nenhum plano contratado</Text>
        <Text style={[s.description, { marginBottom: 24 }]}>Compare os preços e benefícios e encontre a opção ideal para você.</Text>
        <TouchableOpacity accessibilityRole="button" style={s.primary} onPress={() => router.push('/gerenciar-assinatura')}><Text style={s.primaryText}>Conhecer planos</Text><Ionicons name="arrow-forward" size={18} color="#092c32" /></TouchableOpacity>
      </View>
      <Text style={s.sectionTitle}>Conheça nossos planos</Text>
      <Text style={s.sectionDescription}>Compare os benefícios de cada opção.</Text>
      {planos.map(plano => <View key={plano.id} style={[s.card, { marginBottom: 16 }]}>
        <Text style={s.planName}>{plano.nome}</Text>
        <Text style={s.description}>{plano.descricao}</Text>
        <PlanPrice value={plano.preco} />
        <View style={s.divider} />
        <PlanBenefits items={plano.beneficios} />
      </View>)}
      <View style={s.note}><Ionicons name="leaf-outline" size={18} color="#73d6d0" /><Text style={s.noteText}>Planos flexíveis para diferentes necessidades. Economize mais, pague menos.</Text></View>
    </SubscriptionScreen>
  );
}
