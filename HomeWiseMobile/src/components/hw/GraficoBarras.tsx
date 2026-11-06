import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, NUMEROS, alfa } from '@/constants/hw-tema';
import { useMovimentoReduzido } from '@/hooks/use-movimento-reduzido';
import { SeloDesatualizado } from '@/components/AvisoFalhaLeituras';

type Barra = { label: string; valor: number | null };

const ALTURA = 150;
/** Altura mínima de uma barra positiva para continuar visível; zero e ausência de leitura não usam barra. */
const ALTURA_MINIMA_POSITIVA = 4;
const GAP = 10;
const BASE_ROTULO = 26; // espaço do rótulo do período abaixo das barras
const LARGURA_BALAO = 196;

/** Rótulo com só a primeira letra maiúscula (textTransform: capitalize alteraria cada palavra). */
const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Como cada período é desenhado. Exportado para os testes. */
export function tipoBarra(valor: number | null): 'sem-leitura' | 'zero' | 'positivo' {
  if (valor === null) return 'sem-leitura';
  return valor > 0 ? 'positivo' : 'zero';
}

/** Altura proporcional à escala real; zero medido e período sem leitura têm altura 0. */
export function alturaBarra(valor: number | null, maior: number, altura = ALTURA) {
  if (tipoBarra(valor) !== 'positivo') return 0;
  return Math.max(((valor as number) / maior) * altura, ALTURA_MINIMA_POSITIVA);
}

/** Valor acima da barra: um positivo que arredondaria para zero aparece como "<0.1", nunca como "0.0". */
export function textoValorBarra(valor: number, casas: number) {
  if (valor > 0 && Number(valor.toFixed(casas)) === 0) return `<${(10 ** -casas).toFixed(casas)}`;
  return valor.toFixed(casas);
}

/** Valor do balão com precisão suficiente para positivos pequenos (ex.: 0.034, 0.0021). */
export function textoValorDetalhe(valor: number) {
  if (valor === 0) return '0';
  const abs = Math.abs(valor);
  // Sem zeros à direita (88.4, não 88.40), mantendo casas suficientes para valores pequenos
  if (abs >= 100) return String(Number(valor.toFixed(1)));
  if (abs >= 1) return String(Number(valor.toFixed(2)));
  if (abs >= 0.01) return String(Number(valor.toFixed(3)));
  return String(Number(valor.toPrecision(2)));
}

/** Posição horizontal do balão: centrado na coluna e mantido dentro da área do gráfico. */
export function posicaoBalao(indice: number, quantidade: number, largura: number, larguraBalao = LARGURA_BALAO) {
  const w = Math.min(larguraBalao, largura);
  const coluna = (largura - GAP * (quantidade - 1)) / quantidade;
  const centro = indice * (coluna + GAP) + coluna / 2;
  return { left: Math.min(Math.max(centro - w / 2, 0), Math.max(largura - w, 0)), width: w, centro };
}

/**
 * Gráfico de barras dos períodos (mesmo padrão em Água e Energia, variando só a cor).
 * A última barra é o período atual e recebe destaque.
 * - Valor positivo: barra proporcional à escala real.
 * - Zero medido: linha sólida na base, com o valor 0.
 * - Sem leitura: base tracejada e "sem leitura", nunca exibida como zero.
 * Com `onSelecionar`, cada barra vira um botão (toque, clique, Enter/Espaço) que abre um balão
 * com período, métrica, valor e unidade. Escape (web), tocar fora (camada da tela) ou tocar de novo fecha.
 */
export default function GraficoBarras({
  barras, maior, cor, casas = 1, unidade, chaveAnimacao, metrica, selecionado = null, onSelecionar, desatualizado = false
}: {
  barras: Barra[];
  /** Escala calculada pela tela (maior valor do período, mínimo 1). */
  maior: number;
  cor: string;
  casas?: number;
  /** Unidade exibida no balão e lida pelo leitor de tela (ex.: "L", "W"). */
  unidade?: string;
  chaveAnimacao: string;
  /** Nome da métrica no balão (ex.: "Consumo no período", "Potência média"). */
  metrica?: string;
  /** Índice da barra selecionada (controlado pela tela) ou null. */
  selecionado?: number | null;
  onSelecionar?: (indice: number | null) => void;
  /** Fonte com erro e dados anteriores: o balão indica "Desatualizado". */
  desatualizado?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const [progresso] = useState(() => new Animated.Value(1));
  const [largura, setLargura] = useState(0);
  const temZero = barras.some((b) => tipoBarra(b.valor) === 'zero');
  const temSemLeitura = barras.some((b) => tipoBarra(b.valor) === 'sem-leitura');
  // Com muitas colunas (Mês) o texto não cabe no celular: usa um traço e a legenda explica
  const textoSemLeitura = barras.length > 4 ? '—' : 'sem leitura';
  const interativo = !!onSelecionar;
  const indiceSelecionado = interativo && selecionado !== null && selecionado < barras.length ? selecionado : null;
  const sufixo = unidade ? ` ${unidade}` : '';

  useEffect(() => {
    if (reduzido) { progresso.setValue(1); return; }
    progresso.setValue(0);
    const animacao = Animated.timing(progresso, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animacao.start();
    return () => animacao.stop();
  }, [chaveAnimacao, reduzido, progresso]);

  // Escape fecha o balão (teclado físico na web); o listener existe só enquanto há seleção
  useEffect(() => {
    if (indiceSelecionado === null || !onSelecionar || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const aoTeclar = (evento: KeyboardEvent) => { if (evento.key === 'Escape') onSelecionar(null); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [indiceSelecionado, onSelecionar]);

  const barraSelecionada = indiceSelecionado !== null ? barras[indiceSelecionado] : null;
  // O balão fica logo abaixo do gráfico, alinhado à coluna e dentro da largura: não cobre barras nem valores
  const balao = barraSelecionada && largura > 0 ? posicaoBalao(indiceSelecionado as number, barras.length, largura) : null;

  function descricao(barra: Barra) {
    const tipo = tipoBarra(barra.valor);
    const periodo = primeiraMaiuscula(barra.label);
    if (tipo === 'sem-leitura') return `${periodo}: sem leituras`;
    return `${periodo}: ${textoValorDetalhe(barra.valor as number)}${sufixo}${tipo === 'zero' ? ', medido' : ''}`;
  }

  return (
    <View>
      <View style={styles.area} onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}>
        {[0, 0.5, 1].map((p) => <View key={p} style={[styles.guia, { bottom: BASE_ROTULO + p * ALTURA }]} />)}
        {barras.map((barra, indice) => {
          const atual = indice === barras.length - 1;
          const ehSelecionada = indiceSelecionado === indice;
          const esmaecida = indiceSelecionado !== null && !ehSelecionada;
          const tipo = tipoBarra(barra.valor);
          const corBarra = ehSelecionada || (atual && indiceSelecionado === null) ? cor : alfa(cor, esmaecida ? 0.25 : 0.38);
          const valorTexto = tipo === 'sem-leitura' ? '' : textoValorBarra(barra.valor as number, casas);
          const conteudo = (
            <>
              <Text
                style={[
                  styles.valor,
                  (atual || ehSelecionada) && { color: C.texto },
                  tipo === 'sem-leitura' && styles.valorSemLeitura
                ]}
                numberOfLines={1}
              >
                {tipo === 'sem-leitura' ? textoSemLeitura : valorTexto}
              </Text>
              {tipo === 'sem-leitura' ? (
                <View style={[styles.vazia, ehSelecionada && { borderColor: cor }]} />
              ) : tipo === 'zero' ? (
                <View style={[styles.zero, { backgroundColor: corBarra }]} />
              ) : (
                <Animated.View
                  style={[
                    styles.barra,
                    ehSelecionada && styles.barraSelecionada,
                    {
                      height: progresso.interpolate({ inputRange: [0, 1], outputRange: [0, alturaBarra(barra.valor, maior)] }),
                      backgroundColor: corBarra
                    }
                  ]}
                />
              )}
              <Text
                style={[styles.rotulo, (atual || ehSelecionada) && { color: C.textoSec, fontWeight: '700' }, ehSelecionada && { color: cor }]}
                numberOfLines={1}
              >
                {primeiraMaiuscula(barra.label)}
              </Text>
            </>
          );
          const chave = `${barra.label}-${indice}`;
          if (!interativo) {
            return <View key={chave} style={styles.coluna} accessible accessibilityLabel={descricao(barra)}>{conteudo}</View>;
          }
          return (
            <TouchableOpacity
              key={chave}
              style={[styles.coluna, styles.colunaInterativa, ehSelecionada && { backgroundColor: alfa(cor, 0.08) }]}
              activeOpacity={0.75}
              onPress={() => onSelecionar?.(ehSelecionada ? null : indice)}
              accessibilityRole="button"
              accessibilityState={{ selected: ehSelecionada }}
              accessibilityLabel={descricao(barra)}
              accessibilityHint={ehSelecionada ? 'Toque para fechar os detalhes' : 'Toque para ver os detalhes do período'}
            >
              {conteudo}
            </TouchableOpacity>
          );
        })}

      </View>
      {barraSelecionada && balao && (
        <View
          style={[styles.balao, { marginLeft: balao.left, width: balao.width, borderColor: alfa(cor, 0.55) }]}
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.seta, { left: Math.min(Math.max(balao.centro - balao.left - 6, 12), balao.width - 24), borderColor: alfa(cor, 0.55) }]} />
          <View style={styles.balaoTopo}>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.balaoPeriodo, { color: cor }]} numberOfLines={1}>{primeiraMaiuscula(barraSelecionada.label)}</Text>
              {!!metrica && <Text style={styles.balaoMetrica} numberOfLines={1}>{metrica}</Text>}
            </View>
            <TouchableOpacity
              onPress={() => onSelecionar?.(null)}
              style={styles.balaoFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhes"
              hitSlop={8}
            >
              <Ionicons name="close" size={14} color={C.textoSec} />
            </TouchableOpacity>
          </View>
          {tipoBarra(barraSelecionada.valor) === 'sem-leitura' ? (
            <Text style={styles.balaoSemLeitura}>Sem leituras neste período</Text>
          ) : (
            <Text style={styles.balaoValor}>
              {textoValorDetalhe(barraSelecionada.valor as number)}
              {!!unidade && <Text style={styles.balaoUnidade}>{sufixo}</Text>}
            </Text>
          )}
          {tipoBarra(barraSelecionada.valor) === 'zero' && <Text style={styles.balaoNota}>Zero medido</Text>}
          <SeloDesatualizado visivel={desatualizado} />
        </View>
      )}
      {(temZero || temSemLeitura) && (
        <View style={styles.legenda}>
          {temZero && (
            <View style={styles.itemLegenda}>
              <View style={[styles.amostraZero, { backgroundColor: cor }]} />
              <Text style={styles.textoLegenda}>0 medido</Text>
            </View>
          )}
          {temSemLeitura && (
            <View style={styles.itemLegenda}>
              <View style={styles.amostraVazia} />
              <Text style={styles.textoLegenda}>Sem leitura no período</Text>
            </View>
          )}
        </View>
      )}
      {interativo && <Text style={styles.dica}>Toque em uma barra para ver os detalhes.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: ALTURA + 52,
    gap: GAP
  },
  guia: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.bordaSuave
  },
  coluna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  colunaInterativa: { alignSelf: 'stretch', borderRadius: 12, paddingTop: 4 },
  valor: { color: C.textoTer, fontSize: 11, fontWeight: '700', marginBottom: 6, ...NUMEROS },
  valorSemLeitura: { fontWeight: '500', fontSize: 10 },
  barra: { width: '100%', maxWidth: 46, borderRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barraSelecionada: { borderWidth: 2, borderColor: C.texto },
  zero: { width: '100%', maxWidth: 46, height: 3, borderRadius: 2 },
  vazia: {
    width: '100%',
    maxWidth: 46,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.bordaForte
  },
  rotulo: { color: C.textoTer, fontSize: 11, marginTop: 8, height: 18 },
  balao: {
    marginTop: 12,
    backgroundColor: C.fundoProfundo,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
  },
  seta: {
    position: 'absolute',
    top: -7,
    width: 12,
    height: 12,
    backgroundColor: C.fundoProfundo,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }]
  },
  balaoTopo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  balaoPeriodo: { fontSize: 12, fontWeight: '800' },
  balaoMetrica: { color: C.textoSec, fontSize: 11.5, marginTop: 1 },
  balaoFechar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.superficieAlta },
  balaoValor: { color: C.texto, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 4, ...NUMEROS },
  balaoUnidade: { color: C.textoSec, fontSize: 13, fontWeight: '600', letterSpacing: 0 },
  balaoSemLeitura: { color: C.textoSec, fontSize: 13, fontWeight: '600', marginTop: 4 },
  balaoNota: { color: C.textoTer, fontSize: 11 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amostraZero: { width: 16, height: 3, borderRadius: 2 },
  amostraVazia: { width: 16, height: 6, borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: C.bordaForte },
  textoLegenda: { color: C.textoTer, fontSize: 11 },
  dica: { color: C.textoTer, fontSize: 11, marginTop: 8 }
});
