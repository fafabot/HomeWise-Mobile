import type { ComponentRef, PropsWithChildren, Ref } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, LARGURA_MAXIMA, NUMEROS, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

export function SubscriptionScreen({ title, onBack, scrollRef, children }: PropsWithChildren<{ title: string; onBack: () => void; scrollRef?: Ref<ComponentRef<typeof ScrollView>> }>) {
  return (
    <SafeAreaView style={subscriptionStyles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={subscriptionStyles.content}>
        <CabecalhoTela titulo={title} onVoltar={onBack} />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PlanBenefits({ items }: { items: readonly string[] }) {
  return (
    <View style={subscriptionStyles.benefits}>
      {items.map(text => (
        <View style={subscriptionStyles.benefit} key={text}>
          <View style={subscriptionStyles.benefitIcon}>
            <Ionicons name="checkmark" size={12} color={C.marca} />
          </View>
          <Text style={subscriptionStyles.benefitText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

export function PlanPrice({ value, annualTotal, isAnnual }: { value: string; annualTotal?: string; isAnnual?: boolean }) {
  return (
    <View style={subscriptionStyles.priceWrap}>
      <View style={subscriptionStyles.priceRow}>
        <Text style={subscriptionStyles.currency}>R$</Text>
        <Text style={subscriptionStyles.price}>{value}</Text>
        <Text style={subscriptionStyles.period}>/mês</Text>
      </View>
      <Text style={subscriptionStyles.billingSub}>
        {isAnnual && annualTotal
          ? `Cobrado anualmente (R$ ${annualTotal}/ano • 15% OFF)`
          : 'Cobrado mensalmente • Sem fidelidade'}
      </Text>
    </View>
  );
}

export const subscriptionStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.fundo },
  content: { width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center', padding: 20, paddingTop: 12, paddingBottom: 40 },
  eyebrow: { color: C.marca, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  title: { color: C.texto, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 },
  subtitle: { color: C.textoSec, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: C.superficie, borderWidth: 1, borderColor: C.borda, borderRadius: 22, padding: 20, overflow: 'hidden' },
  featured: { backgroundColor: C.superficieAlta, borderColor: alfa(C.marca, 0.55) },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  icon: { width: 46, height: 46, borderRadius: 15, backgroundColor: alfa(C.marca, 0.12), borderWidth: 1, borderColor: alfa(C.marca, 0.3), alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderColor: alfa(C.marca, 0.5), backgroundColor: alfa(C.marca, 0.12), borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  badgeText: { color: C.marca, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  planName: { color: C.texto, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  description: { color: C.textoSec, fontSize: 13, lineHeight: 20, marginTop: 4 },
  priceWrap: { marginTop: 18, marginBottom: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 },
  currency: { color: C.textoSec, fontSize: 16, fontWeight: '700' },
  price: { color: C.texto, fontSize: 38, fontWeight: '800', letterSpacing: -1.2, ...NUMEROS },
  period: { color: C.textoSec, fontSize: 13 },
  billingSub: { color: C.marca, fontSize: 12, marginTop: 4 },
  divider: { height: 1, backgroundColor: C.bordaSuave },
  benefits: { gap: 12, paddingVertical: 20 },
  benefit: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  benefitIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: alfa(C.marca, 0.14), alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  benefitText: { color: C.textoSec, fontSize: 13, lineHeight: 20, flex: 1 },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: C.marcaForte, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  primaryText: { color: '#ffffff', fontSize: 14.5, fontWeight: '700' },
  secondary: { minHeight: 52, borderRadius: 16, backgroundColor: alfa(C.marca, 0.08), borderWidth: 1, borderColor: alfa(C.marca, 0.35), justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  secondaryText: { color: C.marca, fontSize: 14.5, fontWeight: '700' },
  sectionTitle: { color: C.texto, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 30, marginBottom: 6 },
  sectionDescription: { color: C.textoSec, fontSize: 13, lineHeight: 20, marginBottom: 18 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 20, padding: 14, borderRadius: 16, backgroundColor: C.superficie, borderWidth: 1, borderColor: C.bordaSuave },
  noteText: { color: C.textoTer, fontSize: 12, lineHeight: 18, flex: 1 },
});
