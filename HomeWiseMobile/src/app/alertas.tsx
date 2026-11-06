import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  centralEstaOnline,
  leituraEhDeHoje
} from '@/services/leiturasService';
import { disponibilidade, exibivel, mensagemErroLeituras, useLeiturasCentral } from '@/hooks/use-leituras-central';
import AvisoFalhaLeituras from '@/components/AvisoFalhaLeituras';
import {
  calcularStatusBaseline,
  StatusBaseline
} from '@/services/baselineService';
import {
  PREFERENCIAS_NOTIFICACOES_PADRAO,
  PreferenciasNotificacoes
} from '@/services/authService';

import { useAuth } from '@/contexts/AuthContext';
import { C, LARGURA_MAXIMA, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

export default function AlertasScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId, atualizarPreferenciasNotificacoes } = useAuth();
  const leituras = useLeiturasCentral(user?.uid, dispositivoId);
  const { leitura, historico, historicoDiario, ultima, bruto, diario } = leituras;
  const estadoLeitura = ultima.estado;
  const erroLeitura = ultima.erro;
  const [relogioMs, setRelogioMs] = useState(() => Date.now());
  const prefs: PreferenciasNotificacoes = {
    ...PREFERENCIAS_NOTIFICACOES_PADRAO,
    ...(perfil?.preferencias_notificacoes || {})
  };
  const [mostrarFiltros, setMostrarFiltros] = useState<boolean>(
    Boolean(perfil?.preferencias_notificacoes?.permitir_notificacoes)
  );
  const [mensagemPermissao, setMensagemPermissao] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setRelogioMs(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const agoraMs = Math.max(relogioMs, ultima.recebidoEmMs);
  const temCentral = Boolean(dispositivoId && dispositivoId.trim());
  // Com erro na última leitura, uma leitura anterior não comprova que a central está ao vivo
  const online = temCentral && estadoLeitura === 'pronto' && centralEstaOnline(leitura, agoraMs);
  // A linha de base combina histórico bruto + diário
  const dispBaseline = disponibilidade(bruto, diario);
  const ehDeHoje = temCentral && leituraEhDeHoje(leitura, new Date(agoraMs));
  const leiturasParaCalculo = leitura ? [...historico, leitura] : historico;

  const statusBaseline: StatusBaseline = calcularStatusBaseline(
    historicoDiario,
    ehDeHoje && leitura ? Number(leitura.consumo_agua_litros) : 0,
    ehDeHoje && leitura ? Number(leitura.energia_kwh) : 0,
    leiturasParaCalculo
  );

  // Regras reais de anomalia baseadas nos sensores (apenas quando a central está transmitindo ao vivo)
  const vazamentoDetectado = online && leitura ? (leitura.vazao_l_min > 5.0 && leitura.consumo_agua_litros > 50) : false;
  const potenciaDetectada = online && leitura ? (leitura.potencia_w > 3500) : false;
  const tensaoDetectada = online && leitura ? (leitura.tensao_v > 0 && (leitura.tensao_v < 100 || leitura.tensao_v > 140)) : false;
  const desvioBaselineDetectado =
    exibivel(dispBaseline) &&
    statusBaseline.fase === 'calibrado' &&
    (statusBaseline.comparativoAguaPercent > 20 || statusBaseline.comparativoEnergiaPercent > 20);

  // Aplica os filtros escolhidos pelo usuario quando as notificacoes personalizadas estao configuradas
  const vazamentoAtivo = vazamentoDetectado && prefs.vazamento_agua;
  const potenciaExcessiva = potenciaDetectada && prefs.pico_energia;
  const tensaoAnormal = tensaoDetectada && prefs.tensao_rede;
  const desvioBaselineAtivo = desvioBaselineDetectado && prefs.desvio_linha_base;

  async function alternarPermissaoGeral() {
    const novoValor = !prefs.permitir_notificacoes;
    setMensagemPermissao(null);

    if (novoValor) {
      const notifGlobal = (globalThis as any).Notification;
      if (notifGlobal && typeof notifGlobal.requestPermission === 'function') {
        try {
          const resultado = await notifGlobal.requestPermission();
          if (resultado === 'denied') {
            setMensagemPermissao(
              'Permissão negada no navegador/sistema. Libere as notificações nas configurações do aparelho para receber avisos.'
            );
            return;
          }
        } catch {
          // Segue com a ativacao das preferencias internas no app
        }
      }
      setMostrarFiltros(true);
      setMensagemPermissao('Notificações ativadas! Escolha abaixo quais tipos de alerta deseja receber.');
    } else {
      setMensagemPermissao('Notificações desativadas neste dispositivo.');
    }

    const novasPrefs: PreferenciasNotificacoes = {
      ...prefs,
      permitir_notificacoes: novoValor
    };
    await atualizarPreferenciasNotificacoes(novasPrefs);
  }

  async function alternarFiltro(chave: keyof Omit<PreferenciasNotificacoes, 'permitir_notificacoes'>) {
    const novasPrefs: PreferenciasNotificacoes = {
      ...prefs,
      [chave]: !prefs[chave]
    };
    await atualizarPreferenciasNotificacoes(novasPrefs);
  }

  const cardStatusCentral = !temCentral
    ? {
        id: 4,
        tipo: 'aviso',
        titulo: 'Nenhuma Central Vinculada',
        local: 'Configuração pendente no Perfil',
        descricao: 'Vincule o código da sua Central HomeWise na aba Perfil para iniciar o monitoramento.',
        icone: 'link-outline' as const,
        corBorda: '#854d0e',
        corFundo: '#2e2009',
        corTexto: '#facc15'
      }
    : estadoLeitura === 'carregando'
    ? {
        id: 4,
        tipo: 'aviso',
        titulo: 'Verificando a Central HomeWise',
        local: `Dispositivo ${dispositivoId}`,
        descricao: 'Carregando as medições mais recentes da central.',
        icone: 'sync-outline' as const,
        corBorda: '#173244',
        corFundo: '#0e222e',
        corTexto: '#9db1bd'
      }
    : estadoLeitura === 'erro'
    ? {
        id: 4,
        tipo: 'aviso',
        titulo: 'Status da Central Indisponível',
        local: `Dispositivo ${dispositivoId}`,
        descricao: `${mensagemErroLeituras(erroLeitura)} Os alertas de vazamento, pico e tensão não podem ser verificados até a consulta ser restabelecida.`,
        icone: 'alert-circle-outline' as const,
        corBorda: '#7f1d1d',
        corFundo: '#261414',
        corTexto: '#f87171'
      }
    : online
    ? {
        id: 4,
        tipo: 'sucesso',
        titulo: 'Monitoramento HomeWise Ativo',
        local: `Dispositivo ${dispositivoId}`,
        descricao: 'Os sensores de vazão e grandezas elétricas estão operando e transmitindo em tempo real.',
        icone: 'shield-checkmark' as const,
        corBorda: '#14532d',
        corFundo: '#0b2419',
        corTexto: '#4ade80'
      }
    : {
        id: 4,
        tipo: 'aviso',
        titulo: leitura ? 'Central HomeWise Desligada / Offline' : 'Aguardando Conexão da Central',
        local: `Dispositivo ${dispositivoId}`,
        descricao: leitura
          ? 'A central parou de enviar leituras recentes. Verifique se o ESP8266 está ligado na tomada e conectado ao Wi-Fi.'
          : 'Aguardando o primeiro envio de dados do ESP8266.',
        icone: 'cloud-offline-outline' as const,
        corBorda: '#7f1d1d',
        corFundo: '#261414',
        corTexto: '#f87171'
      };

  const alertas = [
    ...(vazamentoAtivo ? [{
      id: 1,
      tipo: 'critico',
      titulo: 'Possível vazamento detectado',
      local: `Sensor YF-S201 • Vazão contínua de ${leitura?.vazao_l_min.toFixed(1)} L/min`,
      descricao: 'Foi identificada uma vazão persistente de água sem interrupção. Verifique torneiras, descargas ou tubulações.',
      icone: 'warning' as const,
      corBorda: '#7f1d1d',
      corFundo: '#261414',
      corTexto: '#f87171'
    }] : []),
    ...(potenciaExcessiva ? [{
      id: 2,
      tipo: 'aviso',
      titulo: 'Pico de consumo elétrico',
      local: `Medidor PZEM-004T • ${leitura?.potencia_w.toFixed(0)} W`,
      descricao: 'A potência ativa da residência ultrapassou 3.500 W. Verifique equipamentos de alto consumo como chuveiro ou ar-condicionado.',
      icone: 'flash' as const,
      corBorda: '#854d0e',
      corFundo: '#2e2009',
      corTexto: '#facc15'
    }] : []),
    ...(tensaoAnormal ? [{
      id: 3,
      tipo: 'aviso',
      titulo: 'Instabilidade na tensão da rede',
      local: `Rede elétrica • ${leitura?.tensao_v.toFixed(0)} V`,
      descricao: 'A tensão alternada está fora da faixa nominal recomendada (127V ± 10%).',
      icone: 'speedometer' as const,
      corBorda: '#854d0e',
      corFundo: '#2e2009',
      corTexto: '#facc15'
    }] : []),
    ...(desvioBaselineAtivo ? [{
      id: 3.5,
      tipo: 'aviso',
      titulo: 'Consumo acima da Linha de Base',
      local: 'Inteligência HomeTrack • Desvio > 20%',
      descricao: 'O consumo medido hoje ultrapassou em mais de 20% a média diária aprendida no mês de treinamento.',
      icone: 'trending-up' as const,
      corBorda: '#854d0e',
      corFundo: '#2e2009',
      corTexto: '#facc15'
    }] : []),
    ...(prefs.status_central || online ? [cardStatusCentral] : []),
    !exibivel(dispBaseline) ? {
      id: 5,
      tipo: 'aviso',
      titulo: dispBaseline === 'indisponivel' ? 'Linha de Base Indisponível' : 'Carregando Linha de Base',
      local: 'Inteligência Comportamental',
      descricao: dispBaseline === 'indisponivel'
        ? 'Não foi possível carregar o histórico de consumo para avaliar a linha de base.'
        : 'Carregando o histórico de consumo da sua residência.',
      icone: (dispBaseline === 'indisponivel' ? 'alert-circle-outline' : 'sync-outline') as 'alert-circle-outline' | 'sync-outline',
      corBorda: '#173244',
      corFundo: '#0e222e',
      corTexto: '#9db1bd'
    } : {
      id: 5,
      tipo: statusBaseline.fase === 'calibrado' ? 'sucesso' : 'aviso',
      titulo: statusBaseline.fase === 'calibrado' ? 'Linha de Base Calibrada' : 'Fase de Aprendizado Ativa',
      local: `Inteligência Comportamental • ${statusBaseline.diasRegistrados}/${statusBaseline.metaDias} dias analisados${dispBaseline === 'desatualizado' ? ' • Dados desatualizados' : ''}`,
      descricao: statusBaseline.fase === 'calibrado'
        ? `A média diária da sua residência foi calibrada em ${statusBaseline.mediaAguaLitrosDia} L/dia de água e ${statusBaseline.mediaEnergiaKwhDia} kWh/dia de energia. O sistema monitora e alerta desvios anormais superiores a 20%.`
        : 'Durante os primeiros 30 dias de uso, o ecossistema HomeWise aprende a rotina real dos moradores para personalizar os alertas de desperdício sem falsos positivos.',
      icone: 'analytics' as const,
      corBorda: statusBaseline.fase === 'calibrado' ? '#0369a1' : '#854d0e',
      corFundo: statusBaseline.fase === 'calibrado' ? '#0c2333' : '#2e2009',
      corTexto: statusBaseline.fase === 'calibrado' ? '#38bdf8' : '#facc15'
    }
  ];


  // ----- Apenas apresentação -----
  // Ids < 4 são os alertas ativos (sensores e desvio de linha de base); >= 4 são diagnósticos do sistema.
  const alertasAtivos = alertas.filter((alerta) => alerta.id < 4);
  const diagnosticos = alertas.filter((alerta) => alerta.id >= 4);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.conteudo}>

          <CabecalhoTela titulo="Alertas e Diagnóstico" onVoltar={() => router.push('/')} />

          <Text style={styles.subtituloPagina}>
            Regras de negócio e monitoramento contínuo da sua residência
          </Text>

          {/* Aviso de falha nas consultas de leituras (com opção de tentar novamente) */}
          <AvisoFalhaLeituras fontes={leituras.fontes} onTentarNovamente={leituras.tentarNovamente} />

          {/* Card de Permissão e Configuração de Notificações */}
          <View style={[
            styles.cardNotificacoes,
            prefs.permitir_notificacoes
              ? { borderColor: alfa(C.marca, 0.45) }
              : { borderColor: C.borda }
          ]}>
            <View style={styles.notifHeader}>
              <View style={[
                styles.notifIconeBox,
                { backgroundColor: alfa(prefs.permitir_notificacoes ? C.marca : C.textoSec, 0.14) }
              ]}>
                <Ionicons
                  name={prefs.permitir_notificacoes ? 'notifications' : 'notifications-off-outline'}
                  size={20}
                  color={prefs.permitir_notificacoes ? C.marca : C.textoSec}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.notifTituloRow}>
                  <Text style={styles.notifTitulo}>Permitir notificações</Text>
                  <View style={[
                    styles.notifBadgeStatus,
                    { backgroundColor: alfa(prefs.permitir_notificacoes ? C.ok : C.textoTer, 0.15) }
                  ]}>
                    <Text style={[
                      styles.notifBadgeTexto,
                      { color: prefs.permitir_notificacoes ? C.ok : C.textoSec }
                    ]}>
                      {prefs.permitir_notificacoes ? 'ATIVADAS' : 'DESATIVADAS'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.notifSubtitulo}>
                  {prefs.permitir_notificacoes
                    ? 'Você receberá avisos conforme os filtros selecionados abaixo.'
                    : 'Ative para ser avisado sobre vazamentos, picos e quedas da central.'}
                </Text>
              </View>
              <BotaoSwitch
                ativo={prefs.permitir_notificacoes}
                cor={C.marca}
                rotulo="Permitir notificações"
                onPress={alternarPermissaoGeral}
              />
            </View>

            {mensagemPermissao && (
              <Text style={styles.notifMensagemFeedback}>{mensagemPermissao}</Text>
            )}

            <TouchableOpacity
              style={styles.botaoExpandirFiltros}
              activeOpacity={0.7}
              onPress={() => setMostrarFiltros((atual) => !atual)}
              accessibilityRole="button"
              accessibilityLabel="Configurar tipos de notificação"
            >
              <Ionicons name="options-outline" size={15} color={C.marca} />
              <Text style={styles.textoExpandirFiltros}>
                {mostrarFiltros ? 'Ocultar filtros de notificação' : 'Filtrar tipos de notificação que desejo receber'}
              </Text>
              <Ionicons
                name={mostrarFiltros ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={C.marca}
              />
            </TouchableOpacity>

            {mostrarFiltros && (
              <View style={styles.listaFiltros}>
                <ItemFiltroNotificacao
                  icone="water-outline"
                  cor={C.agua}
                  titulo="Vazamentos de água"
                  descricao="Alerta crítico de vazão contínua (> 5,0 L/min)"
                  ativo={prefs.vazamento_agua}
                  desabilitado={!prefs.permitir_notificacoes}
                  onToggle={() => alternarFiltro('vazamento_agua')}
                />
                <ItemFiltroNotificacao
                  icone="flash-outline"
                  cor={C.energia}
                  titulo="Picos de consumo elétrico"
                  descricao="Aviso quando a potência ativa passar de 3.500 W"
                  ativo={prefs.pico_energia}
                  desabilitado={!prefs.permitir_notificacoes}
                  onToggle={() => alternarFiltro('pico_energia')}
                />
                <ItemFiltroNotificacao
                  icone="speedometer-outline"
                  cor={C.alerta}
                  titulo="Instabilidade na tensão"
                  descricao="Rede elétrica fora da faixa segura (100V a 140V)"
                  ativo={prefs.tensao_rede}
                  desabilitado={!prefs.permitir_notificacoes}
                  onToggle={() => alternarFiltro('tensao_rede')}
                />
                <ItemFiltroNotificacao
                  icone="analytics-outline"
                  cor={C.marca}
                  titulo="Desvios da Linha de Base"
                  descricao="Consumo diário mais de 20% acima da média aprendida"
                  ativo={prefs.desvio_linha_base}
                  desabilitado={!prefs.permitir_notificacoes}
                  onToggle={() => alternarFiltro('desvio_linha_base')}
                />
                <ItemFiltroNotificacao
                  icone="cloud-offline-outline"
                  cor="#f87171"
                  titulo="Status da Central (Offline)"
                  descricao="Aviso quando a central ESP8266 ficar desligada"
                  ativo={prefs.status_central}
                  desabilitado={!prefs.permitir_notificacoes}
                  ultima
                  onToggle={() => alternarFiltro('status_central')}
                />
              </View>
            )}
          </View>

          {/* Resumo: só afirma "nenhum alerta" quando a central está ao vivo */}
          <View
            style={[
              styles.resumo,
              alertasAtivos.length > 0
                ? { borderColor: alfa(C.perigo, 0.45), backgroundColor: alfa(C.perigo, 0.07) }
                : online
                ? { borderColor: alfa(C.ok, 0.4), backgroundColor: alfa(C.ok, 0.06) }
                : null
            ]}
            accessibilityLiveRegion="polite"
          >
            <View style={[styles.resumoIcone, {
              backgroundColor: alfa(alertasAtivos.length > 0 ? C.perigo : online ? C.ok : C.textoSec, 0.14)
            }]}>
              <Ionicons
                name={alertasAtivos.length > 0 ? 'warning' : online ? 'shield-checkmark' : 'help-circle-outline'}
                size={22}
                color={alertasAtivos.length > 0 ? C.perigo : online ? C.ok : C.textoSec}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumoNumero}>
                {alertasAtivos.length > 0
                  ? `${alertasAtivos.length} ${alertasAtivos.length === 1 ? 'alerta ativo' : 'alertas ativos'}`
                  : online
                  ? 'Nenhum alerta ativo'
                  : 'Alertas não verificados'}
              </Text>
              <Text style={styles.resumoTexto}>
                {alertasAtivos.length > 0
                  ? 'Confira os detalhes abaixo e verifique sua residência.'
                  : online
                  ? 'Vazão, potência e tensão dentro dos limites agora.'
                  : 'Os alertas dependem das medições da central ao vivo.'}
              </Text>
            </View>
          </View>

          {alertasAtivos.length > 0 && (
            <>
              <Text style={styles.secao}>ALERTAS ATIVOS</Text>
              {alertasAtivos.map((alerta) => <CartaoAlerta key={alerta.id} alerta={alerta} />)}
            </>
          )}

          <Text style={styles.secao}>DIAGNÓSTICO DO SISTEMA</Text>
          {diagnosticos.map((alerta) => <CartaoAlerta key={alerta.id} alerta={alerta} />)}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ItemAlerta = {
  tipo: string;
  titulo: string;
  local: string;
  descricao: string;
  icone: keyof typeof Ionicons.glyphMap;
  corBorda: string;
  corTexto: string;
};

const ROTULO_TIPO: Record<string, string> = { critico: 'CRÍTICO', aviso: 'AVISO', sucesso: 'OK' };

function CartaoAlerta({ alerta }: { alerta: ItemAlerta }) {
  return (
    <View
      style={[styles.cardAlerta, { borderColor: alfa(alerta.corTexto, 0.32), backgroundColor: alfa(alerta.corTexto, 0.045) }]}
      accessible
      accessibilityLabel={`${ROTULO_TIPO[alerta.tipo] ?? ''} ${alerta.titulo}. ${alerta.local}. ${alerta.descricao}`}
    >
      <View style={[styles.faixa, { backgroundColor: alerta.corTexto }]} />
      <View style={styles.alertaTopo}>
        <View style={[styles.alertaIcone, { backgroundColor: alfa(alerta.corTexto, 0.14) }]}>
          <Ionicons name={alerta.icone} size={18} color={alerta.corTexto} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tituloAlerta}>{alerta.titulo}</Text>
          <Text style={styles.localAlerta}>{alerta.local}</Text>
        </View>
        {!!ROTULO_TIPO[alerta.tipo] && (
          <View style={[styles.chip, { backgroundColor: alfa(alerta.corTexto, 0.14) }]}>
            <Text style={[styles.chipTexto, { color: alerta.corTexto }]}>{ROTULO_TIPO[alerta.tipo]}</Text>
          </View>
        )}
      </View>
      <Text style={styles.descAlerta}>{alerta.descricao}</Text>
    </View>
  );
}

function BotaoSwitch({
  ativo,
  cor,
  rotulo,
  desabilitado = false,
  onPress
}: {
  ativo: boolean;
  cor: string;
  rotulo: string;
  desabilitado?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="switch"
      accessibilityState={{ checked: ativo, disabled: desabilitado }}
      accessibilityLabel={rotulo}
      style={[
        styles.switchTrilho,
        ativo ? { backgroundColor: cor, borderColor: cor } : { backgroundColor: C.fundo, borderColor: C.borda },
        desabilitado ? { opacity: 0.45 } : null
      ]}
    >
      <View
        style={[
          styles.switchBolha,
          ativo
            ? { alignSelf: 'flex-end', backgroundColor: '#041019' }
            : { alignSelf: 'flex-start', backgroundColor: C.textoSec }
        ]}
      />
    </TouchableOpacity>
  );
}

function ItemFiltroNotificacao({
  icone,
  cor,
  titulo,
  descricao,
  ativo,
  desabilitado,
  ultima = false,
  onToggle
}: {
  icone: keyof typeof Ionicons.glyphMap;
  cor: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  desabilitado?: boolean;
  ultima?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.itemFiltro, !ultima && styles.itemFiltroBorda]}>
      <View style={[styles.itemFiltroIcone, { backgroundColor: alfa(cor, 0.13) }]}>
        <Ionicons name={icone} size={17} color={cor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemFiltroTitulo}>{titulo}</Text>
        <Text style={styles.itemFiltroDesc}>{descricao}</Text>
      </View>
      <BotaoSwitch
        ativo={ativo}
        cor={cor}
        rotulo={`Filtro de notificação: ${titulo}`}
        desabilitado={desabilitado}
        onPress={onToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fundo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  conteudo: { width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' },
  subtituloPagina: { color: C.textoTer, fontSize: 13, textAlign: 'center', marginTop: -10, marginBottom: 20 },
  cardNotificacoes: {
    backgroundColor: C.superficie,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  notifIconeBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notifTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2
  },
  notifTitulo: {
    color: C.texto,
    fontSize: 15,
    fontWeight: '700'
  },
  notifBadgeStatus: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999
  },
  notifBadgeTexto: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  notifSubtitulo: {
    color: C.textoSec,
    fontSize: 12,
    lineHeight: 16
  },
  notifMensagemFeedback: {
    color: C.marca,
    fontSize: 12,
    marginTop: 10,
    lineHeight: 16
  },
  botaoExpandirFiltros: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: C.bordaSuave,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  textoExpandirFiltros: {
    color: C.marca,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1
  },
  listaFiltros: {
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.bordaSuave
  },
  itemFiltro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10
  },
  itemFiltroBorda: {
    borderBottomWidth: 1,
    borderBottomColor: C.bordaSuave
  },
  itemFiltroIcone: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemFiltroTitulo: {
    color: C.texto,
    fontSize: 13.5,
    fontWeight: '600'
  },
  itemFiltroDesc: {
    color: C.textoTer,
    fontSize: 11.5,
    marginTop: 1,
    lineHeight: 15
  },
  switchTrilho: {
    width: 46,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 3,
    justifyContent: 'center'
  },
  switchBolha: {
    width: 18,
    height: 18,
    borderRadius: 9
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.superficie,
    borderWidth: 1,
    borderColor: C.borda,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24
  },
  resumoIcone: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resumoNumero: { color: C.texto, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  resumoTexto: { color: C.textoSec, fontSize: 13, lineHeight: 18, marginTop: 2 },
  secao: { color: C.textoTer, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  cardAlerta: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden'
  },
  faixa: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  alertaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  alertaIcone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tituloAlerta: { color: C.texto, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  localAlerta: { color: C.textoTer, fontSize: 12, marginTop: 2, lineHeight: 16 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipTexto: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  descAlerta: { color: C.textoSec, fontSize: 13, lineHeight: 19 }
});
