import type { PropsWithChildren } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export function SubscriptionScreen({ title, onBack, children }: PropsWithChildren<{ title: string; onBack: () => void }>) {
  return (
    <SafeAreaView style={subscriptionStyles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
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
  return <View style={subscriptionStyles.benefits}>{items.map(text => <View style={subscriptionStyles.benefit} key={text}><Ionicons name="checkmark-circle" size={17} color="#72d6d0" /><Text style={subscriptionStyles.benefitText}>{text}</Text></View>)}</View>;
}

export function PlanPrice({ value }: { value: string }) {
  return <View style={subscriptionStyles.priceRow}><Text style={subscriptionStyles.price}>R$ {value}</Text><Text style={subscriptionStyles.period}>/mês</Text></View>;
}

export const subscriptionStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07131b' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingTop: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 28 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0e222e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1e3a4b' },
  headerSpacer: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '700' },
  eyebrow: { color: '#73d6d0', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, marginBottom: 10 },
  title: { color: '#f1f6f8', fontSize: 29, fontWeight: '800', letterSpacing: -0.7, lineHeight: 37 },
  subtitle: { color: '#94aab4', fontSize: 14, lineHeight: 23, marginTop: 10, marginBottom: 26 },
  card: { backgroundColor: '#0b1d28', borderWidth: 1, borderColor: '#1e3a4b', borderRadius: 20, padding: 22 },
  featured: { backgroundColor: '#102d30', borderColor: '#417a77' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#173a40', alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderColor: '#3f7371', backgroundColor: '#183e3e', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  badgeText: { color: '#a0e6d9', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  planName: { color: '#eff5f6', fontSize: 25, fontWeight: '700' },
  description: { color: '#9eb4ba', fontSize: 13, lineHeight: 22, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 7, marginTop: 24, marginBottom: 24 },
  price: { color: '#eff6f7', fontSize: 36, fontWeight: '800', letterSpacing: -1.4 },
  period: { color: '#94aeb4', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#264047' },
  benefits: { gap: 16, paddingVertical: 23 },
  benefit: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  benefitText: { color: '#c4d3d8', fontSize: 13, lineHeight: 19, flex: 1 },
  primary: { minHeight: 50, borderRadius: 12, backgroundColor: '#76d7cd', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 16 },
  primaryText: { color: '#092c32', fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#2b4b57', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  secondaryText: { color: '#d4e1e7', fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: '#f1f6f8', fontSize: 21, fontWeight: '700', marginTop: 28, marginBottom: 8 },
  sectionDescription: { color: '#8fa6b3', fontSize: 13, lineHeight: 21, marginBottom: 20 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 22 },
  noteText: { color: '#8fa6b3', fontSize: 11, lineHeight: 19, flex: 1 },
});
