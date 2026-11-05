import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, alfa } from '@/constants/hw-tema';
import BotaoDestaque from '@/components/hw/BotaoDestaque';

/** Convite para o plano Plus quando o usuário toca em um recurso bloqueado. */
export default function CartaoUpgrade({ titulo, descricao, acao, onPress }: {
  titulo: string;
  descricao: string;
  acao: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.topo}>
        <View style={styles.icone}><Ionicons name="lock-closed" size={15} color={C.marca} /></View>
        <Text style={styles.titulo}>{titulo}</Text>
      </View>
      <Text style={styles.descricao}>{descricao}</Text>
      <BotaoDestaque rotulo={acao} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.superficieAlta,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borda,
    marginBottom: 16,
    gap: 10
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: alfa(C.marca, 0.12),
    alignItems: 'center',
    justifyContent: 'center'
  },
  titulo: { color: C.texto, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  descricao: { color: C.textoSec, fontSize: 12.5, lineHeight: 18 }
});
