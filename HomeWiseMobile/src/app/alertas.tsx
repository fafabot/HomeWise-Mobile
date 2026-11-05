import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar
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

import { useAuth } from '@/contexts/AuthContext';
import { C, LARGURA_MAXIMA, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

export default function AlertasScreen() {
  const router = useRouter();
  const { user, dispositivoId } = useAuth();
  const leituras = useLeiturasCentral(user?.uid, dispositivoId);
  const { leitura, historico, historicoDiario, ultima, bruto, diario } = leituras;
  const estadoLeitura = ultima.estado;
  const erroLeitura = ultima.erro;
  const [relogioMs, setRelogioMs] = useState(() => Date.now());

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
  const vazamentoAtivo = online && leitura ? (leitura.vazao_l_min > 5.0 && leitura.consumo_agua_litros > 50) : false;
  const potenciaExcessiva = online && leitura ? (leitura.potencia_w > 3500) : false;
  const tensaoAnormal = online && leitura ? (leitura.tensao_v > 0 && (leitura.tensao_v < 100 || leitura.tensao_v > 140)) : false;

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
    cardStatusCentral,
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
  // Ids 1–3 são os alertas dos sensores; 4 e 5 são diagnósticos do sistema.
  const alertasAtivos = alertas.filter((alerta) => alerta.id <= 3);
  const diagnosticos = alertas.filter((alerta) => alerta.id > 3);

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fundo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  conteudo: { width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' },
  subtituloPagina: { color: C.textoTer, fontSize: 13, textAlign: 'center', marginTop: -10, marginBottom: 20 },
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
