import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C, NUMEROS, alfa } from '@/constants/hw-tema';
import { useMovimentoReduzido } from '@/hooks/use-movimento-reduzido';

type Barra = { label: string; valor: number | null };

const ALTURA = 150;

/**
 * Gráfico de barras dos períodos. A última barra é o período atual e recebe destaque.
 * Barras sem leituras aparecem como base tracejada, nunca como zero.
 */
export default function GraficoBarras({ barras, maior, cor, casas = 1, chaveAnimacao }: {
  barras: Barra[];
  /** Escala calculada pela tela (maior valor do período, mínimo 1). */
  maior: number;
  cor: string;
  casas?: number;
  chaveAnimacao: string;
}) {
  const reduzido = useMovimentoReduzido();
  const [progresso] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduzido) { progresso.setValue(1); return; }
    progresso.setValue(0);
    const animacao = Animated.timing(progresso, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animacao.start();
    return () => animacao.stop();
  }, [chaveAnimacao, reduzido, progresso]);

  return (
    <View>
      <View style={styles.area}>
        {[0, 0.5, 1].map((p) => <View key={p} style={[styles.guia, { bottom: 26 + p * ALTURA }]} />)}
        {barras.map((barra, indice) => {
          const atual = indice === barras.length - 1;
          const altura = barra.valor === null ? 0 : Math.max((barra.valor / maior) * ALTURA, 6);
          return (
            <View
              key={`${barra.label}-${indice}`}
              style={styles.coluna}
              accessible
              accessibilityLabel={`${barra.label}: ${barra.valor === null ? 'sem leituras' : barra.valor.toFixed(casas)}`}
            >
              <Text style={[styles.valor, atual && { color: C.texto }]} numberOfLines={1}>
                {barra.valor === null ? '—' : barra.valor.toFixed(casas)}
              </Text>
              {barra.valor === null ? (
                <View style={styles.vazia} />
              ) : (
                <Animated.View
                  style={[
                    styles.barra,
                    {
                      height: progresso.interpolate({ inputRange: [0, 1], outputRange: [0, altura] }),
                      backgroundColor: atual ? cor : alfa(cor, 0.38)
                    }
                  ]}
                />
              )}
              <Text style={[styles.rotulo, atual && { color: C.textoSec, fontWeight: '700' }]} numberOfLines={1}>{barra.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: ALTURA + 52,
    gap: 10
  },
  guia: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.bordaSuave
  },
  coluna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  valor: { color: C.textoTer, fontSize: 11, fontWeight: '700', marginBottom: 6, ...NUMEROS },
  barra: { width: '100%', maxWidth: 46, borderRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  vazia: {
    width: '100%',
    maxWidth: 46,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.bordaForte
  },
  rotulo: { color: C.textoTer, fontSize: 11, marginTop: 8, height: 18, textTransform: 'capitalize' }
});
