import { Text, TouchableOpacity, View } from 'react-native';
export default function LocalReviewNotice() {
  if (process.env.EXPO_PUBLIC_HOMEWISE_REVIEW !== '1') return null;
  const review = (globalThis as typeof globalThis & { __HOMEWISE_REVIEW__?: {
    seed: () => void; sensors: () => void; incomplete: () => void; offline: (value: boolean) => void; failNextProfile: () => void;
  } }).__HOMEWISE_REVIEW__;
  if (!review) return <Text>Revisão indisponível: mocks não inicializados.</Text>;
  return <View style={{ backgroundColor: '#422b00', padding: 6, gap: 4 }}>
    <Text style={{ color: '#fff', fontSize: 12 }}>REVISÃO LOCAL — MOCKS — dados sintéticos, sem Firebase real</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {([['Conta demo', () => review.seed()], ['Sensores sintéticos', () => review.sensors()], ['Perfil incompleto', () => review.incomplete()],
        ['Sem conexão', () => review.offline(true)], ['Reconectar', () => review.offline(false)],
        ['Falhar próximo perfil', () => review.failNextProfile()]] as const).map(([label, onPress]) =>
        <TouchableOpacity key={label} onPress={onPress}><Text style={{ color: '#ffda8a', fontSize: 12 }}>{label}</Text></TouchableOpacity>)}
    </View>
  </View>;
}
