import type { PropsWithChildren } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export function SubscriptionScreen({ title, onBack, children }: PropsWithChildren<{ title: string; onBack: () => void }>) {
  return (
    <SafeAreaView style={subscriptionStyles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={subscriptionStyles.content}>
        <View style={subscriptionStyles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={subscriptionStyles.back}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
          <Text accessibilityRole="header" style={subscriptionStyles.headerTitle}>{title}</Text>
          <View style={subscriptionStyles.headerSpacer} />
        </View>
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
          <Ionicons name="checkmark-circle" size={17} color="#38bdf8" />
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
        <Text style={subscriptionStyles.price}>R$ {value}</Text>
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
  screen: { flex: 1, backgroundColor: '#07131b' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingTop: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0e222e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1e3a4b' },
  headerSpacer: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#ffffff', fontSize: 18, fontWeight: '700' },
  eyebrow: { color: '#38bdf8', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: '#0b1d28', borderWidth: 1, borderColor: '#1e3a4b', borderRadius: 20, padding: 20 },
  featured: { backgroundColor: '#0c2738', borderColor: '#0284c7' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#0f2b3c', borderWidth: 1, borderColor: '#164e63', alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.18)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6 },
  badgeText: { color: '#38bdf8', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  planName: { color: '#ffffff', fontSize: 24, fontWeight: '700' },
  description: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 4 },
  priceWrap: { marginTop: 18, marginBottom: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  price: { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  period: { color: '#94a3b8', fontSize: 13 },
  billingSub: { color: '#38bdf8', fontSize: 12, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#132838' },
  benefits: { gap: 14, paddingVertical: 20 },
  benefit: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  benefitText: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, flex: 1 },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 50, borderRadius: 14, backgroundColor: '#0f2b3c', borderWidth: 1, borderColor: '#164e63', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  secondaryText: { color: '#22b7d4', fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginTop: 26, marginBottom: 6 },
  sectionDescription: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginBottom: 18 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 20 },
  noteText: { color: '#64748b', fontSize: 12, lineHeight: 18, flex: 1 },
});
