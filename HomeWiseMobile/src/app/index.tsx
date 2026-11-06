import React, { useState, useEffect } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  centralEstaOnline,
  leituraEhDeHoje
} from '@/services/leiturasService';
import { disponibilidade, exibivel, useLeiturasCentral } from '@/hooks/use-leituras-central';
import AvisoFalhaLeituras, { SeloDesatualizado } from '@/components/AvisoFalhaLeituras';
import { C, LARGURA_MAXIMA, NUMEROS } from '@/constants/hw-tema';
import {
  calcularStatusBaseline,
  StatusBaseline
} from '@/services/baselineService';
import { calcularConsumoPorPeriodo } from '@/utils/grafico-periodos';

import { useAuth } from '@/contexts/AuthContext';

// Tarifas medias para calculo financeiro (R$ por unidade)
const TARIFA_AGUA_POR_LITRO = 0.0085; // ~R$ 8,50 por m³ (1000L)
const TARIFA_ENERGIA_KWH = 0.85;      // ~R$ 0,85 por kWh

export default function HomeScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId } = useAuth();
  // Última leitura, histórico bruto e resumos diários da central deste usuário (estados separados por fonte)
  const leituras = useLeiturasCentral(user?.uid, dispositivoId);
  const { leitura, historico, historicoDiario, ultima, bruto, diario } = leituras;
  const estadoLeitura = ultima.estado;
  const [relogioMs, setRelogioMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setRelogioMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const agoraMs = Math.max(relogioMs, ultima.recebidoEmMs);
  const agoraData = new Date(agoraMs);
  // Sem resposta válida da última leitura (carregando ou erro), o status da central é desconhecido.
  // Uma leitura anterior a um erro não comprova que a central está ao vivo nem gera alertas.
  const statusDesconhecido = !!dispositivoId && estadoLeitura !== 'pronto';
  const online = !statusDesconhecido && centralEstaOnline(leitura, agoraMs);
  // Totais, custo e linha de base combinam histórico bruto + diário: só são completos com as duas fontes
  const dispTotais = disponibilidade(bruto, diario);
  const totaisDisponiveis = exibivel(dispTotais);
  const totaisDesatualizados = dispTotais === 'desatualizado';
  const ehDeHoje = leituraEhDeHoje(leitura, agoraData);
  const leiturasParaCalculo = leitura ? [...historico, leitura] : historico;

  // Consumo real do dia de hoje e acumulado real do mes atual (sem multiplicar leituras antigas)
  const aguaHojeNum = calcularConsumoPorPeriodo(
    leiturasParaCalculo,
    'dia',
    'consumo_agua_litros',
    historicoDiario,
    agoraData
  );
  const energiaHojeNum = calcularConsumoPorPeriodo(
    leiturasParaCalculo,
    'dia',
    'energia_kwh',
    historicoDiario,
    agoraData
  );
  const aguaMesNum = calcularConsumoPorPeriodo(
    leiturasParaCalculo,
    'mes',
    'consumo_agua_litros',
    historicoDiario,
    agoraData
  );
  const energiaMesNum = calcularConsumoPorPeriodo(
    leiturasParaCalculo,
    'mes',
    'energia_kwh',
    historicoDiario,
    agoraData
  );

  const aguaHoje = totaisDisponiveis ? aguaHojeNum.toFixed(1) : '--';
  const energiaHoje = totaisDisponiveis ? energiaHojeNum.toFixed(2) : '--';
  const aguaMes = totaisDisponiveis ? aguaMesNum.toFixed(0) : '--';
  const energiaMes = totaisDisponiveis ? energiaMesNum.toFixed(1) : '--';

  const vazaoAtual = statusDesconhecido ? '--' : leitura && online ? Number(leitura.vazao_l_min).toFixed(1) : '0.0';
  const potenciaAtual = statusDesconhecido ? '--' : leitura && online ? Number(leitura.potencia_w).toFixed(0) : '0';
  const tensaoAtual = statusDesconhecido ? '--' : leitura && online ? Number(leitura.tensao_v).toFixed(0) : '0';

  // Inteligencia da Linha de Base (Baseline de 30 dias + Previsao do Mes Inteiro)
  const statusBaseline: StatusBaseline = calcularStatusBaseline(
    historicoDiario,
    aguaHojeNum,
    energiaHojeNum,
    leiturasParaCalculo,
    agoraData
  );

  const diasComputadosMes = statusBaseline.diasComputadosMesAtual ?? 0;
  const diasRestantesMes = statusBaseline.diasRestantesMesAtual ?? 30;
  const aguaPrevistaMesNum = statusBaseline.previsaoAguaMesInteiroLitros ?? (aguaMesNum + diasRestantesMes * statusBaseline.mediaAguaLitrosDia);
  const energiaPrevistaMesNum = statusBaseline.previsaoEnergiaMesInteiroKwh ?? (energiaMesNum + diasRestantesMes * statusBaseline.mediaEnergiaKwhDia);

  const aguaMesPrevisto = totaisDisponiveis ? Number(aguaPrevistaMesNum).toFixed(0) : '--';
  const energiaMesPrevisto = totaisDisponiveis ? Number(energiaPrevistaMesNum).toFixed(1) : '--';

  // Custo estimado do mes inteiro: soma os dias ja computados no mes + (dias restantes * media aprendida)
  const custoAgua = aguaPrevistaMesNum * TARIFA_AGUA_POR_LITRO;
  const custoEnergia = energiaPrevistaMesNum * TARIFA_ENERGIA_KWH;
  const totalPrevisto = totaisDisponiveis ? (custoAgua + custoEnergia).toFixed(2) : '--';

  // Valores financeiros (R$) gastos hoje, acumulados nos dias medidos e media diaria prevista
  const custoAguaHojeNum = aguaHojeNum * TARIFA_AGUA_POR_LITRO;
  const custoEnergiaHojeNum = energiaHojeNum * TARIFA_ENERGIA_KWH;
  const custoTotalHoje = totaisDisponiveis ? (custoAguaHojeNum + custoEnergiaHojeNum).toFixed(2).replace('.', ',') : '--';
  const custoAguaHoje = totaisDisponiveis ? custoAguaHojeNum.toFixed(2).replace('.', ',') : '--';
  const custoEnergiaHoje = totaisDisponiveis ? custoEnergiaHojeNum.toFixed(2).replace('.', ',') : '--';

  const custoAcumuladoMesNum = (aguaMesNum * TARIFA_AGUA_POR_LITRO) + (energiaMesNum * TARIFA_ENERGIA_KWH);
  const custoAcumuladoMes = totaisDisponiveis ? custoAcumuladoMesNum.toFixed(2).replace('.', ',') : '--';

  const custoMedioDiaAprendidoNum =
    (statusBaseline.mediaAguaLitrosDia * TARIFA_AGUA_POR_LITRO) +
    (statusBaseline.mediaEnergiaKwhDia * TARIFA_ENERGIA_KWH);
  const custoMedioDiaAprendido = totaisDisponiveis ? custoMedioDiaAprendidoNum.toFixed(2).replace('.', ',') : '--';

  // Deteccao automatica de anomalias/vazamento (apenas quando a central esta transmitindo ao vivo)
  const prefsNotif = perfil?.preferencias_notificacoes;
  const possivelVazamento =
    online && leitura && (prefsNotif?.vazamento_agua !== false)
      ? (leitura.vazao_l_min > 5.0 && leitura.consumo_agua_litros > 50)
      : false;
  const consumoElevado =
    online && leitura && (prefsNotif?.pico_energia !== false)
      ? (leitura.potencia_w > 3500)
      : false;

  const dataHoraUltimaLeitura = leitura?.criado_em && leitura.criado_em.getTime() > 0
    ? (ehDeHoje
        ? new Date(leitura.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date(leitura.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
    : '--:--:--';

  // ----- Apenas apresentação: nenhuma regra de cálculo ou de estado abaixo -----
  const temAlerta = possivelVazamento || consumoElevado;
  const tom: Tom = !dispositivoId || estadoLeitura === 'carregando'
    ? 'neutro'
    : estadoLeitura === 'erro'
    ? 'erro'
    : temAlerta
    ? 'alerta'
    : !online
    ? 'offline'
    : 'ok';
  const cores = TONS[tom];

  const textoSituacao = !dispositivoId
    ? "Aguardando vinculação da central"
    : estadoLeitura === 'carregando'
    ? "Carregando medições da central..."
    : estadoLeitura === 'erro'
    ? "Não foi possível verificar a central"
    : !online
    ? "Central desligada / sem comunicação"
    : possivelVazamento
    ? "Atenção: Vazão contínua detectada"
    : consumoElevado
    ? "Alerta: Potência acima da média"
    : "Consumo dentro do esperado";

  const iconeSituacao: keyof typeof Ionicons.glyphMap = temAlerta ? "alert"
    : estadoLeitura === 'carregando' && dispositivoId ? "sync-outline"
    : estadoLeitura === 'erro' ? "alert-circle-outline"
    : !online ? "cloud-offline-outline" : "checkmark";

  const textoBadge = online ? "AO VIVO"
    : !dispositivoId ? "SEM CENTRAL"
    : estadoLeitura === 'carregando' ? "CONECTANDO"
    : estadoLeitura === 'erro' ? "INDISPONÍVEL"
    : leitura ? "DESLIGADA" : "AGUARDANDO ESP";

  const dataExtenso = agoraData.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const nome = perfil?.nome || user?.displayName || 'Morador';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.conteudo}>

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.perfilContainer}>
              <Image
                source={require('@/assets/images/logo homewise.png')}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="Logo HomeWise"
              />
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.data}>{dataExtenso}</Text>
                <Text style={styles.saudacao} numberOfLines={1}>Olá, {nome}!</Text>
                <Text style={styles.subSaudacao} numberOfLines={1}>
                  {dispositivoId ? `Central: ${dispositivoId}` : 'Nenhuma central vinculada'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.botaoSino}
              activeOpacity={0.7}
              onPress={() => router.push('/alertas')}
              accessibilityRole="button"
              accessibilityLabel={temAlerta ? 'Alertas: há alertas ativos' : 'Alertas'}
            >
              <Ionicons name="notifications-outline" size={20} color={C.texto} />
              {temAlerta && <View style={styles.badgeNotif} />}
            </TouchableOpacity>
          </View>

          {/* Banner de vinculação quando não há central */}
          {!dispositivoId && (
            <View style={styles.cardSemCentral}>
              <View style={styles.topoCardSemCentral}>
                <View style={styles.iconeSemCentral}>
                  <Ionicons name="hardware-chip-outline" size={22} color={C.alerta} />
                </View>
                <View style={styles.conteudoSemCentral}>
                  <Text style={styles.tituloSemCentral}>Vincule sua Central HomeWise</Text>
                  <Text style={styles.descricaoSemCentral}>
                    Escaneie o QR Code ou informe o código da sua central para acompanhar suas medições.
                  </Text>
                </View>
              </View>

              <View style={styles.botoesAcaoSemCentral}>
                <TouchableOpacity
                  style={styles.botaoScanPrincipal}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  onPress={() => router.push('/escanear-qrcode' as any)}
                >
                  <Ionicons name="qr-code-outline" size={16} color={C.fundo} style={{ marginRight: 6 }} />
                  <Text style={styles.textoBotaoScanPrincipal}>Escanear QR Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botaoDigitarSecundario}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  onPress={() => router.push('/editar-perfil')}
                >
                  <Text style={styles.textoBotaoDigitarSecundario}>Digitar Código</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Aviso de falha nas consultas de leituras (com opção de tentar novamente) */}
          <AvisoFalhaLeituras fontes={leituras.fontes} onTentarNovamente={leituras.tentarNovamente} />

          {/* Painel principal: situação da casa + previsão da conta */}
          <View style={[styles.painel, { borderColor: cores.borda }]}>
            <View style={[styles.painelFaixa, { backgroundColor: cores.destaque }]} />
            <View style={styles.painelTopo}>
              <Text style={styles.etiqueta}>SITUAÇÃO DO SISTEMA</Text>
              <View style={[styles.badgeLive, { backgroundColor: cores.fundoBadge }]}>
                <PontoAoVivo ativo={online} cor={cores.destaque} />
                <Text style={[styles.badgeLiveTexto, { color: cores.destaque }]}>{textoBadge}</Text>
              </View>
            </View>

            <View style={styles.situacaoLinha} accessibilityLiveRegion="polite">
              <View style={[styles.situacaoIcone, { backgroundColor: cores.fundoIcone }]}>
                <Ionicons name={iconeSituacao} size={20} color={cores.destaque} />
              </View>
              <Text style={styles.situacaoStatus}>{textoSituacao}</Text>
            </View>

            <View style={styles.painelDivisor} />

            <View style={styles.contaLinha}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.contaLabel}>Total previsto da conta</Text>
                <Text style={styles.contaValor}>
                  <Text style={styles.contaMoeda}>R$ </Text>{totalPrevisto.replace('.', ',')}
                </Text>
                <View style={styles.linhaVariacao}>
                  <Ionicons name="calculator-outline" size={13} color={C.textoTer} />
                  <Text style={styles.contaSub}>
                    {totaisDisponiveis
                      ? `${diasComputadosMes}d medidos + ${diasRestantesMes}d pela média aprendida`
                      : 'Baseado na tarifa de consumo atual'}
                  </Text>
                </View>
                <SeloDesatualizado visivel={totaisDesatualizados} />
              </View>
              <View style={styles.circuloCifrao}>
                <Ionicons name="cash-outline" size={22} color={C.ok} />
              </View>
            </View>

            {totaisDisponiveis && (
              <View style={styles.resumoFinanceiroBox}>
                <View style={styles.resumoFinanceiroCol}>
                  <Text style={styles.resumoFinanceiroLabel}>Gasto no dia (hoje)</Text>
                  <Text style={styles.resumoFinanceiroValor}>R$ {custoTotalHoje}</Text>
                  <Text style={styles.resumoFinanceiroDetalhe}>Água R$ {custoAguaHoje}</Text>
                  <Text style={styles.resumoFinanceiroDetalhe}>Energia R$ {custoEnergiaHoje}</Text>
                </View>
                <View style={styles.resumoFinanceiroDivisor} />
                <View style={styles.resumoFinanceiroCol}>
                  <Text style={styles.resumoFinanceiroLabel}>Gasto acumulado ({diasComputadosMes}d)</Text>
                  <Text style={styles.resumoFinanceiroValor}>R$ {custoAcumuladoMes}</Text>
                  <Text style={styles.resumoFinanceiroDetalhe}>Média aprendida:</Text>
                  <Text style={styles.resumoFinanceiroDetalhe}>R$ {custoMedioDiaAprendido}/dia</Text>
                </View>
              </View>
            )}
          </View>

          {/* Consumo de hoje */}
          <Text style={styles.secaoTitulo}>Consumo de hoje</Text>
          <View style={styles.rowCards}>
            <CardConsumo
              icone="water"
              cor={C.agua}
              rotulo="Água hoje"
              valor={aguaHoje}
              unidade="L"
              gastoDia={totaisDisponiveis ? `Gasto no dia: R$ ${custoAguaHoje}` : undefined}
              mesMedido={totaisDisponiveis ? `${aguaMes} L (${diasComputadosMes}d)` : `${aguaMes} L este mês`}
              previsaoMes={totaisDisponiveis ? `Previsto: ${aguaMesPrevisto} L` : undefined}
              desatualizado={totaisDesatualizados}
              onPress={() => router.push('/agua')}
            />
            <CardConsumo
              icone="flash"
              cor={C.energia}
              rotulo="Energia hoje"
              valor={energiaHoje}
              unidade="kWh"
              gastoDia={totaisDisponiveis ? `Gasto no dia: R$ ${custoEnergiaHoje}` : undefined}
              mesMedido={totaisDisponiveis ? `${energiaMes} kWh (${diasComputadosMes}d)` : `${energiaMes} kWh este mês`}
              previsaoMes={totaisDisponiveis ? `Previsto: ${energiaMesPrevisto} kWh` : undefined}
              desatualizado={totaisDesatualizados}
              onPress={() => router.push('/energia')}
            />
          </View>

          {/* Alertas ativos */}
          <View style={styles.secaoHeader}>
            <Text style={[styles.secaoTitulo, { marginBottom: 0 }]}>Alertas em tempo real</Text>
            <TouchableOpacity
              onPress={() => router.push('/alertas')}
              accessibilityRole="link"
              hitSlop={8}
              style={styles.secaoLinkBotao}
            >
              <Text style={styles.secaoLink}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={C.marca} />
            </TouchableOpacity>
          </View>

          {possivelVazamento ? (
            <TouchableOpacity
              style={styles.cardAlertaCritico}
              activeOpacity={0.8}
              accessibilityRole="button"
              onPress={() => router.push('/alertas')}
            >
              <View style={styles.alertaIconeBox}>
                <Ionicons name="warning" size={20} color={C.perigo} />
              </View>
              <View style={styles.alertaConteudo}>
                <Text style={styles.alertaTitulo}>Possível vazamento ativo</Text>
                <Text style={styles.alertaSub}>Vazão de {vazaoAtual} L/min identificada pelo sensor YF-S201</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.perigo} />
            </TouchableOpacity>
          ) : statusDesconhecido ? (
            <View style={styles.cardSemAlerta}>
              <Ionicons name={estadoLeitura === 'erro' ? 'alert-circle-outline' : 'sync-outline'} size={20} color={C.textoSec} />
              <Text style={styles.textoSemAlerta}>
                {estadoLeitura === 'erro'
                  ? 'Não é possível verificar alertas sem as medições da central.'
                  : 'Verificando alertas...'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardSemAlerta}>
              <Ionicons name="shield-checkmark-outline" size={20} color={C.ok} />
              <Text style={styles.textoSemAlerta}>Nenhum vazamento ou pico detectado no momento.</Text>
            </View>
          )}

          {/* Medição instantânea da central */}
          <Text style={styles.secaoTitulo}>Agora na central</Text>
          <View style={styles.cardTempoReal}>
            <View style={styles.tempoRealHeader}>
              <Ionicons name="hardware-chip-outline" size={15} color={C.textoTer} />
              <Text style={styles.etiqueta}>CENTRAL ESP8266</Text>
            </View>

            <View style={styles.tempoRealValores}>
              <Medicao icone="speedometer-outline" cor={C.agua} rotulo="Vazão Atual" valor={vazaoAtual} unidade="L/min" />
              <Medicao icone="flash-outline" cor={C.energia} rotulo="Potência Ativa" valor={potenciaAtual} unidade="W" />
              <Medicao icone="pulse-outline" cor={C.marca} rotulo="Tensão AC" valor={tensaoAtual} unidade="V" />
            </View>

            <View style={styles.rodapeCentral}>
              <Text style={styles.textoRodapeCentral}>Dispositivo: {dispositivoId || "Não vinculado"}</Text>
              <Text style={styles.textoRodapeCentral}>Última atualização: {dataHoraUltimaLeitura}</Text>
            </View>
          </View>

          {/* Inteligência e linha de base adaptativa */}
          <View style={styles.cardBaseline}>
            <View style={styles.baselineTopo}>
              <View style={styles.baselineIconeBox}>
                <Ionicons
                  name={statusBaseline.fase === 'calibrado' ? 'sparkles' : 'hourglass-outline'}
                  size={18}
                  color={C.agua}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.etiqueta, { color: C.agua, marginBottom: 3 }]}>INTELIGÊNCIA HOMETRACK • LINHA DE BASE</Text>
                <Text style={styles.baselineTitulo}>
                  {totaisDisponiveis
                    ? statusBaseline.mensagem
                    : dispTotais === 'indisponivel'
                    ? 'Histórico indisponível no momento.'
                    : 'Carregando seu histórico...'}
                </Text>
              </View>
              {totaisDisponiveis && <View style={[
                styles.badgeFase,
                statusBaseline.fase === 'calibrado' ? styles.badgeFaseCalibrado : styles.badgeFaseAprendizado
              ]}>
                <Text style={[
                  styles.badgeFaseTexto,
                  { color: statusBaseline.fase === 'calibrado' ? C.ok : C.agua }
                ]}>
                  {statusBaseline.fase === 'calibrado' ? 'CALIBRADO' : `${statusBaseline.progressoPorcentagem}%`}
                </Text>
              </View>}
            </View>

            {!totaisDisponiveis ? null : statusBaseline.fase === 'aprendizado' ? (
              <View style={styles.barraProgressoContainer}>
                <View
                  style={styles.trilhoProgresso}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: statusBaseline.progressoPorcentagem }}
                >
                  <View style={[styles.preenchimentoProgresso, { width: `${Math.max(statusBaseline.progressoPorcentagem, 8)}%` }]} />
                </View>
                <Text style={styles.subProgresso}>
                  {statusBaseline.diasRegistrados} de {statusBaseline.metaDias} dias analisados • Calibrando rotina residencial
                </Text>
              </View>
            ) : (
              <View style={styles.baselineMetricas}>
                <View style={styles.itemMetricaBaseline}>
                  <Text style={styles.labelMetricaBaseline}>Média Água Aprendida</Text>
                  <Text style={styles.valorMetricaBaseline}>{statusBaseline.mediaAguaLitrosDia} L/dia</Text>
                  <Text style={[styles.labelMetricaBaseline, { marginTop: 4 }]}>
                    Prev. mês: {statusBaseline.previsaoAguaMesInteiroLitros} L
                  </Text>
                </View>
                <View style={styles.divisorMetrica} />
                <View style={styles.itemMetricaBaseline}>
                  <Text style={styles.labelMetricaBaseline}>Média Energia Aprendida</Text>
                  <Text style={styles.valorMetricaBaseline}>{statusBaseline.mediaEnergiaKwhDia} kWh/dia</Text>
                  <Text style={[styles.labelMetricaBaseline, { marginTop: 4 }]}>
                    Prev. mês: {statusBaseline.previsaoEnergiaMesInteiroKwh} kWh
                  </Text>
                </View>
              </View>
            )}

            {totaisDisponiveis && <Text style={styles.dicaBaseline}>{statusBaseline.dica}</Text>}
            <SeloDesatualizado visivel={totaisDesatualizados} />
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Cartão de consumo do dia (água ou energia) que leva à tela de detalhes. */
function CardConsumo({ icone, cor, rotulo, valor, unidade, gastoDia, mesMedido, previsaoMes, desatualizado, onPress }: {
  icone: keyof typeof Ionicons.glyphMap;
  cor: string;
  rotulo: string;
  valor: string;
  unidade: string;
  gastoDia?: string;
  mesMedido: string;
  previsaoMes?: string;
  desatualizado: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.miniCard}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${valor} ${unidade}.${gastoDia ? ` ${gastoDia}.` : ''} ${mesMedido}.${previsaoMes ? ` ${previsaoMes}.` : ''}${desatualizado ? ' Desatualizado.' : ''} Abrir detalhes`}
    >
      <View style={styles.miniCardTopo}>
        <View style={[styles.miniCardIcone, { backgroundColor: `${cor}1f` }]}>
          <Ionicons name={icone} size={16} color={cor} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.textoTer} />
      </View>
      <Text style={styles.miniCardLabel}>{rotulo}</Text>
      <Text style={styles.miniCardValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}<Text style={styles.miniCardUnidade}> {unidade}</Text>
      </Text>
      {gastoDia ? <Text style={[styles.miniCardGastoDia, { color: cor }]} numberOfLines={1}>{gastoDia}</Text> : null}
      <View style={[styles.miniCardTraco, { backgroundColor: cor }]} />
      <Text style={styles.miniCardSub} numberOfLines={1}>{mesMedido}</Text>
      {previsaoMes ? <Text style={styles.miniCardPrev} numberOfLines={1}>{previsaoMes}</Text> : null}
      <SeloDesatualizado visivel={desatualizado} />
    </TouchableOpacity>
  );
}

/** Valor instantâneo enviado pela central. */
function Medicao({ icone, cor, rotulo, valor, unidade }: {
  icone: keyof typeof Ionicons.glyphMap;
  cor: string;
  rotulo: string;
  valor: string;
  unidade: string;
}) {
  return (
    <View style={styles.itemMedicao} accessible accessibilityLabel={`${rotulo}: ${valor} ${unidade}`}>
      <Ionicons name={icone} size={16} color={cor} />
      <Text style={styles.medicaoValor} numberOfLines={1}>
        {valor}<Text style={styles.medicaoUnid}> {unidade}</Text>
      </Text>
      <Text style={styles.medicaoLabel}>{rotulo}</Text>
    </View>
  );
}

const ANIMACAO_NATIVA = Platform.OS !== 'web';

/** Ponto de status; pulsa suavemente só enquanto a central está ao vivo e se o sistema permitir animações. */
function PontoAoVivo({ ativo, cor }: { ativo: boolean; cor: string }) {
  const [opacidade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!ativo) return;
    let montado = true;
    let animacao: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduzir) => {
        if (!montado || reduzir) return;
        animacao = Animated.loop(Animated.sequence([
          Animated.timing(opacidade, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ANIMACAO_NATIVA }),
          Animated.timing(opacidade, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ANIMACAO_NATIVA })
        ]));
        animacao.start();
      })
      .catch(() => {});
    return () => {
      montado = false;
      animacao?.stop();
      opacidade.setValue(1);
    };
  }, [ativo, opacidade]);

  return <Animated.View style={[styles.pontoLive, { backgroundColor: cor, opacity: opacidade }]} />;
}


type Tom = 'ok' | 'alerta' | 'offline' | 'erro' | 'neutro';

const TONS: Record<Tom, { destaque: string; borda: string; fundoIcone: string; fundoBadge: string }> = {
  ok: { destaque: '#22c55e', borda: '#14532d', fundoIcone: 'rgba(34, 197, 94, 0.14)', fundoBadge: 'rgba(34, 197, 94, 0.12)' },
  alerta: { destaque: '#f59e0b', borda: '#854d0e', fundoIcone: 'rgba(245, 158, 11, 0.15)', fundoBadge: 'rgba(245, 158, 11, 0.12)' },
  offline: { destaque: '#f59e0b', borda: '#5c3a0c', fundoIcone: 'rgba(245, 158, 11, 0.12)', fundoBadge: 'rgba(245, 158, 11, 0.10)' },
  erro: { destaque: '#f87171', borda: '#7f1d1d', fundoIcone: 'rgba(248, 113, 113, 0.14)', fundoBadge: 'rgba(248, 113, 113, 0.12)' },
  neutro: { destaque: '#22b7d4', borda: '#173244', fundoIcone: 'rgba(34, 183, 212, 0.12)', fundoBadge: 'rgba(34, 183, 212, 0.10)' }
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.fundo
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40
  },
  conteudo: {
    width: '100%',
    maxWidth: LARGURA_MAXIMA,
    alignSelf: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22
  },
  perfilContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1
  },
  logoImage: {
    width: 46,
    height: 46,
    borderRadius: 14
  },
  data: {
    color: C.textoTer,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: 1
  },
  saudacao: {
    color: C.texto,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  subSaudacao: {
    color: C.textoSec,
    fontSize: 13,
    marginTop: 1
  },
  botaoSino: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.superficie,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borda
  },
  badgeNotif: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: C.superficie
  },
  etiqueta: {
    color: C.textoTer,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.1
  },

  // Painel principal
  painel: {
    backgroundColor: C.superficie,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    marginBottom: 26,
    overflow: 'hidden'
  },
  painelFaixa: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.9
  },
  painelTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999
  },
  pontoLive: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  badgeLiveTexto: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  situacaoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  situacaoIcone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  situacaoStatus: {
    color: C.texto,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    flexShrink: 1
  },
  painelDivisor: {
    height: 1,
    backgroundColor: C.bordaSuave,
    marginVertical: 16
  },
  contaLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  contaLabel: {
    color: C.textoSec,
    fontSize: 13,
    fontWeight: '500'
  },
  contaValor: {
    color: C.texto,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
    marginBottom: 4,
    ...NUMEROS
  },
  contaMoeda: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textoSec,
    letterSpacing: 0
  },
  linhaVariacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  contaSub: {
    color: C.textoTer,
    fontSize: 12
  },
  circuloCifrao: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#14532d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  resumoFinanceiroBox: {
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.fundo,
    borderWidth: 1,
    borderColor: C.bordaSuave,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  resumoFinanceiroCol: {
    flex: 1
  },
  resumoFinanceiroDivisor: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: C.bordaSuave
  },
  resumoFinanceiroLabel: {
    color: C.textoSec,
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 2
  },
  resumoFinanceiroValor: {
    color: C.texto,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    ...NUMEROS
  },
  resumoFinanceiroDetalhe: {
    color: C.textoTer,
    fontSize: 11,
    lineHeight: 15,
    ...NUMEROS
  },

  // Seções
  secaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  secaoTitulo: {
    color: C.texto,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  secaoLinkBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32
  },
  secaoLink: {
    color: C.marca,
    fontSize: 13,
    fontWeight: '600'
  },

  // Consumo de hoje
  rowCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26
  },
  miniCard: {
    flex: 1,
    backgroundColor: C.superficie,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borda,
    padding: 16
  },
  miniCardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  miniCardIcone: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  miniCardLabel: {
    color: C.textoSec,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2
  },
  miniCardValor: {
    color: C.texto,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    ...NUMEROS
  },
  miniCardUnidade: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textoSec,
    letterSpacing: 0
  },
  miniCardGastoDia: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    ...NUMEROS
  },
  miniCardTraco: {
    width: 22,
    height: 3,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8
  },
  miniCardSub: {
    color: C.textoTer,
    fontSize: 12,
    ...NUMEROS
  },
  miniCardPrev: {
    color: C.textoTer,
    fontSize: 11,
    marginTop: 2,
    opacity: 0.85,
    ...NUMEROS
  },

  // Alertas
  cardAlertaCritico: {
    backgroundColor: '#261414',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#7f1d1d'
  },
  cardSemAlerta: {
    backgroundColor: C.superficie,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: C.borda
  },
  textoSemAlerta: {
    color: C.textoSec,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1
  },
  alertaIconeBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#451a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  alertaConteudo: {
    flex: 1
  },
  alertaTitulo: {
    color: C.perigo,
    fontWeight: '700',
    fontSize: 15
  },
  alertaSub: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 2
  },

  // Agora na central
  cardTempoReal: {
    backgroundColor: C.superficie,
    borderRadius: 18,
    padding: 16,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: C.borda
  },
  tempoRealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14
  },
  tempoRealValores: {
    flexDirection: 'row',
    gap: 8
  },
  itemMedicao: {
    flex: 1,
    backgroundColor: C.superficieAlta,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6
  },
  medicaoValor: {
    color: C.texto,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    ...NUMEROS
  },
  medicaoUnid: {
    fontSize: 11,
    color: C.textoSec,
    fontWeight: '600',
    letterSpacing: 0
  },
  medicaoLabel: {
    color: C.textoTer,
    fontSize: 11
  },
  rodapeCentral: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.bordaSuave,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  textoRodapeCentral: {
    color: C.textoTer,
    fontSize: 11
  },

  // Sem central
  cardSemCentral: {
    backgroundColor: '#1a1610',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#78350f'
  },
  topoCardSemCentral: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  iconeSemCentral: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  conteudoSemCentral: {
    flex: 1,
    marginLeft: 12
  },
  tituloSemCentral: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2
  },
  descricaoSemCentral: {
    color: '#e3a857',
    fontSize: 12,
    lineHeight: 17
  },
  botoesAcaoSemCentral: {
    flexDirection: 'row',
    gap: 10
  },
  botaoScanPrincipal: {
    flex: 1.3,
    flexDirection: 'row',
    backgroundColor: C.marca,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textoBotaoScanPrincipal: {
    color: C.fundo,
    fontSize: 13,
    fontWeight: '700'
  },
  botaoDigitarSecundario: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  textoBotaoDigitarSecundario: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },

  // Linha de base
  cardBaseline: {
    backgroundColor: C.superficie,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borda
  },
  baselineTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  baselineIconeBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.13)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  baselineTitulo: {
    color: C.texto,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19
  },
  badgeFase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8
  },
  badgeFaseAprendizado: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: '#0284c7'
  },
  badgeFaseCalibrado: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22c55e'
  },
  badgeFaseTexto: {
    fontSize: 11,
    fontWeight: '800'
  },
  barraProgressoContainer: {
    marginBottom: 10
  },
  trilhoProgresso: {
    height: 6,
    backgroundColor: C.fundo,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6
  },
  preenchimentoProgresso: {
    height: '100%',
    backgroundColor: C.agua,
    borderRadius: 4
  },
  subProgresso: {
    color: C.textoSec,
    fontSize: 11
  },
  baselineMetricas: {
    flexDirection: 'row',
    backgroundColor: C.fundo,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  itemMetricaBaseline: {
    alignItems: 'center',
    flexShrink: 1
  },
  labelMetricaBaseline: {
    color: C.textoTer,
    fontSize: 11,
    marginBottom: 2,
    textAlign: 'center'
  },
  valorMetricaBaseline: {
    color: C.texto,
    fontSize: 15,
    fontWeight: '700',
    ...NUMEROS
  },
  divisorMetrica: {
    width: 1,
    height: 28,
    backgroundColor: C.borda
  },
  dicaBaseline: {
    color: C.textoSec,
    fontSize: 12,
    lineHeight: 17
  }
});
