import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, LARGURA_MAXIMA, NUMEROS, alfa } from '@/constants/hw-tema';

/** Linha de estatística com ícone, rótulo e valor alinhado à direita. */
export function LinhaResumo({ icone, rotulo, valor, cor, ultima }: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  valor: string;
  cor?: string;
  ultima?: boolean;
}) {
  return (
    <View style={[estilosLinha.linha, ultima && { borderBottomWidth: 0 }]} accessible accessibilityLabel={`${rotulo}: ${valor}`}>
      <View style={estilosLinha.esquerda}>
        <Ionicons name={icone} size={15} color={C.textoTer} />
        <Text style={estilosLinha.rotulo}>{rotulo}</Text>
      </View>
      <Text style={[estilosLinha.valor, cor ? { color: cor } : null]}>{valor}</Text>
    </View>
  );
}

const estilosLinha = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.bordaSuave
  },
  esquerda: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rotulo: { color: C.textoSec, fontSize: 13 },
  valor: { color: C.texto, fontSize: 14, fontWeight: '700', textAlign: 'right', ...NUMEROS }
});

/** Estilos comuns de Água e Energia, variando apenas a cor de destaque. */
export function criarEstilosConsumo(acento: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.fundo },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    conteudo: { width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' },

    destaque: {
      backgroundColor: C.superficie,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: alfa(acento, 0.32),
      padding: 20,
      marginBottom: 16,
      overflow: 'hidden'
    },
    destaqueBrilho: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      right: -80,
      top: -110,
      backgroundColor: alfa(acento, 0.08)
    },
    destaqueTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    destaqueIcone: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: alfa(acento, 0.14),
      alignItems: 'center',
      justifyContent: 'center'
    },
    labelConsumo: { color: C.textoSec, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    valorConsumo: {
      color: C.texto,
      fontSize: 44,
      fontWeight: '800',
      letterSpacing: -1.4,
      marginTop: 12,
      marginBottom: 2,
      ...NUMEROS
    },
    unidade: { fontSize: 20, color: C.textoSec, fontWeight: '600', letterSpacing: 0 },
    linhaInfo: { flexDirection: 'row', gap: 10, marginTop: 16 },
    infoBloco: {
      flex: 1,
      backgroundColor: C.superficieAlta,
      borderRadius: 14,
      padding: 12,
      gap: 4
    },
    infoLabel: { color: C.textoTer, fontSize: 11.5 },
    infoValor: { color: C.texto, fontSize: 16, fontWeight: '800', ...NUMEROS },
    infoUnidade: { color: C.textoSec, fontSize: 12, fontWeight: '600' },

    card: {
      backgroundColor: C.superficie,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: C.borda,
      marginBottom: 16
    },
    tituloGrafico: { color: C.texto, fontSize: 15, fontWeight: '700', marginBottom: 4 },
    legenda: { color: C.textoTer, fontSize: 12 },
    resumoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4
    },
    resumoTitulo: { color: C.texto, fontSize: 15, fontWeight: '700' },
    linkBotao: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
    resumoLink: { color: C.marca, fontSize: 13, fontWeight: '600' },
    botaoExportar: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: alfa(acento, 0.35),
      backgroundColor: alfa(acento, 0.1)
    },
    textoExportar: { color: C.texto, fontSize: 13, fontWeight: '700' }
  });
}
