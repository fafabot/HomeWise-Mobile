import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { observarUltimaLeitura, observarHistorico, Leitura } from '@/services/leiturasService';

// Tarifas medias para calculo financeiro (R$ por unidade)
const TARIFA_AGUA_POR_LITRO = 0.0085; // ~R$ 8,50 por m³ (1000L)
const TARIFA_ENERGIA_KWH = 0.85;      // ~R$ 0,85 por kWh

export default function HomeScreen() {
  const router = useRouter();
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [historico, setHistorico] = useState<Leitura[]>([]);

  useEffect(() => {
    // Escuta a leitura mais recente em tempo real do ESP8266
    const unsubLeitura = observarUltimaLeitura((dados) => {
      setLeitura(dados);
    });

    // Escuta o historico para calculo de acumulados
    const unsubHistorico = observarHistorico((dados) => {
      setHistorico(dados);
    });

    return () => {
      unsubLeitura();
      unsubHistorico();
    };
  }, []);

  // Calculos dinamicos a partir das leituras reais do ESP
  const aguaHoje = leitura ? Number(leitura.consumo_agua_litros).toFixed(1) : '0.0';
  const energiaHoje = leitura ? Number(leitura.energia_kwh).toFixed(2) : '0.00';
  const vazaoAtual = leitura ? Number(leitura.vazao_l_min).toFixed(1) : '0.0';
  const potenciaAtual = leitura ? Number(leitura.potencia_w).toFixed(0) : '0';
  const tensaoAtual = leitura ? Number(leitura.tensao_v).toFixed(0) : '0';

  // Acumulado do mes (estimado ou somado do historico)
  const aguaMes = historico.length > 0
    ? historico.reduce((acc, cur) => acc + cur.consumo_agua_litros, 0).toFixed(0)
    : (leitura ? (leitura.consumo_agua_litros * 25).toFixed(0) : '0');

  const energiaMes = historico.length > 0
    ? historico.reduce((acc, cur) => acc + cur.energia_kwh, 0).toFixed(1)
    : (leitura ? (leitura.energia_kwh * 25).toFixed(1) : '0.0');

  // Custo estimado do mes
  const custoAgua = Number(aguaMes) * TARIFA_AGUA_POR_LITRO;
  const custoEnergia = Number(energiaMes) * TARIFA_ENERGIA_KWH;
  const totalPrevisto = (custoAgua + custoEnergia).toFixed(2);

  // Deteccao automatica de anomalias/vazamento
  const possivelVazamento = leitura ? (leitura.vazao_l_min > 5.0 && leitura.consumo_agua_litros > 50) : false;
  const consumoElevado = leitura ? (leitura.potencia_w > 3500) : false;

  const dataHoraUltimaLeitura = leitura?.criado_em
    ? new Date(leitura.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Topo / Header com Logo HomeWise */}
        <View style={styles.header}>
          <View style={styles.perfilContainer}>
            <Image
              source={require('@/assets/images/logo homewise.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.saudacao}>Olá, Matheus!</Text>
              <Text style={styles.subSaudacao}>Resumo da sua residência</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.botaoSino} activeOpacity={0.7} onPress={() => router.push('/alertas')}>
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
            {(possivelVazamento || consumoElevado) && <View style={styles.badgeNotif} />}
          </TouchableOpacity>
        </View>

        {/* Linha dos Cards de Agua e Energia com Dados Reais */}
        <View style={styles.rowCards}>
          {/* Card Agua */}
          <TouchableOpacity style={[styles.miniCard, styles.cardAgua]} activeOpacity={0.8} onPress={() => router.push('/agua')}>
            <View style={styles.miniCardTopo}>
              <Ionicons name="water" size={16} color="#38bdf8" />
              <Text style={styles.miniCardLabel}>Água hoje</Text>
            </View>
            <Text style={styles.miniCardValor}>{aguaHoje} L</Text>
            <Text style={styles.miniCardSub}>{aguaMes} L este mês</Text>
          </TouchableOpacity>

          {/* Card Energia */}
          <TouchableOpacity style={[styles.miniCard, styles.cardEnergia]} activeOpacity={0.8} onPress={() => router.push('/energia')}>
            <View style={styles.miniCardTopo}>
              <Ionicons name="flash" size={16} color="#4ade80" />
              <Text style={styles.miniCardLabel}>Energia hoje</Text>
            </View>
            <Text style={styles.miniCardValor}>{energiaHoje} kWh</Text>
            <Text style={styles.miniCardSub}>{energiaMes} kWh este mês</Text>
          </TouchableOpacity>
        </View>

        {/* Card Total Previsto (Calculo em Reais) */}
        <View style={styles.cardTotalPrevisto}>
          <View>
            <Text style={styles.totalPrevistoLabel}>Total previsto da conta</Text>
            <Text style={styles.totalPrevistoValor}>R$ {totalPrevisto.replace('.', ',')}</Text>
            <View style={styles.linhaVariacao}>
              <Ionicons name="calculator-outline" size={14} color="#22c55e" />
              <Text style={styles.totalPrevistoSub}> Baseado na tarifa de consumo atual</Text>
            </View>
          </View>
          <View style={styles.circuloCifrao}>
            <Ionicons name="cash-outline" size={24} color="#ffffff" />
          </View>
        </View>

        {/* Card Situacao Geral */}
        <View style={[styles.cardSituacao, (possivelVazamento || consumoElevado) && styles.cardSituacaoAlerta]}>
          <View style={styles.situacaoEsquerda}>
            <View style={[styles.checkIconBox, (possivelVazamento || consumoElevado) && styles.checkIconBoxAlerta]}>
              <Ionicons
                name={possivelVazamento || consumoElevado ? "alert" : "checkmark"}
                size={18}
                color={possivelVazamento || consumoElevado ? "#ffffff" : "#07131b"}
              />
            </View>
            <View>
              <Text style={styles.situacaoLabel}>Situação do sistema</Text>
              <Text style={styles.situacaoStatus}>
                {possivelVazamento
                  ? "Atenção: Vazão contínua detectada"
                  : consumoElevado
                  ? "Alerta: Potência acima da média"
                  : "Consumo dentro do esperado"}
              </Text>
            </View>
          </View>
        </View>

        {/* Sessao Alertas Ativos */}
        <View style={styles.secaoHeader}>
          <Text style={styles.secaoTitulo}>Alertas em tempo real</Text>
          <TouchableOpacity onPress={() => router.push('/alertas')}>
            <Text style={styles.secaoLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {/* Card Dinâmico de Alerta */}
        {possivelVazamento ? (
          <TouchableOpacity style={styles.cardAlertaCritico} activeOpacity={0.8} onPress={() => router.push('/alertas')}>
            <View style={styles.alertaIconeBox}>
              <Ionicons name="warning" size={20} color="#f87171" />
            </View>
            <View style={styles.alertaConteudo}>
              <Text style={styles.alertaTitulo}>Possível vazamento ativo</Text>
              <Text style={styles.alertaSub}>Vazão de {vazaoAtual} L/min identificada pelo sensor YF-S201</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#f87171" />
          </TouchableOpacity>
        ) : (
          <View style={styles.cardSemAlerta}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#22c55e" />
            <Text style={styles.textoSemAlerta}>Nenhum vazamento ou pico detectado no momento.</Text>
          </View>
        )}

        {/* Card Medição Instantânea em Tempo Real (Direto do ESP8266) */}
        <View style={styles.cardTempoReal}>
          <View style={styles.tempoRealHeader}>
            <View style={styles.linhaCentral}>
              <Ionicons name="hardware-chip-outline" size={16} color="#64748b" />
              <Text style={styles.tempoRealTitulo}>CENTRAL ESP8266</Text>
            </View>
            <View style={[styles.badgeLive, !leitura && styles.badgeOffline]}>
              <View style={[styles.pontoLive, !leitura && styles.pontoOffline]} />
              <Text style={[styles.badgeLiveTexto, !leitura && styles.badgeOfflineTexto]}>
                {leitura ? "AO VIVO" : "AGUARDANDO ESP"}
              </Text>
            </View>
          </View>

          <View style={styles.tempoRealValores}>
            <View style={styles.itemMedicao}>
              <Text style={styles.medicaoLabel}>Vazão Atual</Text>
              <Text style={styles.medicaoValor}>{vazaoAtual} <Text style={styles.medicaoUnid}>L/min</Text></Text>
            </View>
            <View style={styles.itemMedicao}>
              <Text style={styles.medicaoLabel}>Potência Ativa</Text>
              <Text style={styles.medicaoValor}>{potenciaAtual} <Text style={styles.medicaoUnid}>W</Text></Text>
            </View>
            <View style={styles.itemMedicao}>
              <Text style={styles.medicaoLabel}>Tensão AC</Text>
              <Text style={styles.medicaoValor}>{tensaoAtual} <Text style={styles.medicaoUnid}>V</Text></Text>
            </View>
          </View>

          <View style={styles.rodapeCentral}>
            <Text style={styles.textoRodapeCentral}>Dispositivo: {leitura?.dispositivo_id || "central_homewise_01"}</Text>
            <Text style={styles.textoRodapeCentral}>Última atualização: {dataHoraUltimaLeitura}</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  perfilContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 12
  },
  saudacao: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  subSaudacao: {
    color: '#7e9aa8',
    fontSize: 13
  },
  botaoSino: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0e222e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a4b',
    position: 'relative'
  },
  badgeNotif: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444'
  },
  rowCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  miniCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16
  },
  cardAgua: {
    backgroundColor: '#0c2738',
    borderWidth: 1,
    borderColor: '#164e63'
  },
  cardEnergia: {
    backgroundColor: '#0d2d24',
    borderWidth: 1,
    borderColor: '#065f46'
  },
  miniCardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  miniCardLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500'
  },
  miniCardValor: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4
  },
  miniCardSub: {
    color: '#64748b',
    fontSize: 11
  },
  cardTotalPrevisto: {
    backgroundColor: '#0b1d28',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#133547'
  },
  totalPrevistoLabel: {
    color: '#94a3b8',
    fontSize: 13
  },
  totalPrevistoValor: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    marginVertical: 4
  },
  linhaVariacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  totalPrevistoSub: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '500'
  },
  circuloCifrao: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#15803d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardSituacao: {
    backgroundColor: '#0c221e',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#14532d'
  },
  cardSituacaoAlerta: {
    backgroundColor: '#2b1b0d',
    borderColor: '#854d0e'
  },
  situacaoEsquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  checkIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkIconBoxAlerta: {
    backgroundColor: '#f59e0b'
  },
  situacaoLabel: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '500'
  },
  situacaoStatus: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  secaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  secaoTitulo: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold'
  },
  secaoLink: {
    color: '#7e9aa8',
    fontSize: 13
  },
  cardAlertaCritico: {
    backgroundColor: '#261414',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d'
  },
  cardSemAlerta: {
    backgroundColor: '#0a1d27',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#133547'
  },
  textoSemAlerta: {
    color: '#94a3b8',
    fontSize: 13
  },
  alertaIconeBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#451a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  alertaConteudo: {
    flex: 1
  },
  alertaTitulo: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 15
  },
  alertaSub: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 2
  },
  cardTempoReal: {
    backgroundColor: '#0a1d27',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#133547'
  },
  tempoRealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  linhaCentral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  tempoRealTitulo: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)'
  },
  pontoLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e'
  },
  pontoOffline: {
    backgroundColor: '#ef4444'
  },
  badgeLiveTexto: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: 'bold'
  },
  badgeOfflineTexto: {
    color: '#ef4444'
  },
  tempoRealValores: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  itemMedicao: {
    alignItems: 'center'
  },
  medicaoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4
  },
  medicaoValor: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  medicaoUnid: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'normal'
  },
  rodapeCentral: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#132838',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  textoRodapeCentral: {
    color: '#64748b',
    fontSize: 11
  }
});
