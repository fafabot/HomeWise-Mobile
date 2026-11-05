import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/hw-tema';

type Acao = { icone: keyof typeof Ionicons.glyphMap; rotulo: string; onPress: () => void; indicador?: boolean };

/** Cabeçalho das telas internas: voltar, título com subtítulo opcional e uma ação à direita. */
export default function CabecalhoTela({ titulo, subtitulo, onVoltar, rotuloVoltar = 'Voltar', acao }: {
  titulo: string;
  subtitulo?: string;
  onVoltar?: () => void;
  rotuloVoltar?: string;
  acao?: Acao;
}) {
  return (
    <View style={styles.header}>
      {onVoltar ? (
        <TouchableOpacity style={styles.botao} activeOpacity={0.7} onPress={onVoltar} accessibilityRole="button" accessibilityLabel={rotuloVoltar} hitSlop={4}>
          <Ionicons name="chevron-back" size={22} color={C.texto} />
        </TouchableOpacity>
      ) : <View style={styles.espaco} />}

      <View style={styles.centro}>
        <Text style={styles.titulo} accessibilityRole="header" numberOfLines={1}>{titulo}</Text>
        {!!subtitulo && <Text style={styles.subtitulo} numberOfLines={1}>{subtitulo}</Text>}
      </View>

      {acao ? (
        <TouchableOpacity style={styles.botao} activeOpacity={0.7} onPress={acao.onPress} accessibilityRole="button" accessibilityLabel={acao.rotulo} hitSlop={4}>
          <Ionicons name={acao.icone} size={20} color={C.texto} />
          {acao.indicador && <View style={styles.indicador} />}
        </TouchableOpacity>
      ) : <View style={styles.espaco} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20
  },
  botao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.superficie,
    borderWidth: 1,
    borderColor: C.borda,
    justifyContent: 'center',
    alignItems: 'center'
  },
  espaco: { width: 44, height: 44 },
  centro: { flex: 1, alignItems: 'center' },
  titulo: { color: C.texto, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitulo: { color: C.textoTer, fontSize: 12, marginTop: 1 },
  indicador: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: C.superficie
  }
});
