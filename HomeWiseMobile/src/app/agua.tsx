import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { centralEstaOnline } from '@/services/leiturasService';
import { disponibilidade, exibivel, useLeiturasCentral } from '@/hooks/use-leituras-central';
import AvisoFalhaLeituras, { SeloDesatualizado } from '@/components/AvisoFalhaLeituras';
import { calcularStatusBaseline } from '@/services/baselineService';

import { useAuth } from '@/contexts/AuthContext';
import { temAcessoPlus } from '@/constants/planos';
import {
  montarBarrasPorPeriodo,
  calcularConsumoPorPeriodo,
  obterRotuloConsumoPorPeriodo
} from '@/utils/grafico-periodos';
import { C } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';
import SeletorSegmentado from '@/components/hw/SeletorSegmentado';
import GraficoBarras from '@/components/hw/GraficoBarras';
import CartaoUpgrade from '@/components/hw/CartaoUpgrade';
import { LinhaResumo, criarEstilosConsumo } from '@/components/hw/TelaConsumo';

export default function AguaScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId } = useAuth();
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'ano'>('dia');
  const leituras = useLeiturasCentral(user?.uid, dispositivoId);
  const { leitura, historico, historicoDiario, ultima, bruto, diario } = leituras;
  const estadoLeitura = ultima.estado;
  const [relogioMs, setRelogioMs] = useState(() => Date.now());
  const [avisoUpgrade, setAvisoUpgrade] = useState(false);
  const possuiPlus = temAcessoPlus(perfil?.plano, perfil?.status_assinatura);

  useEffect(() => {
    const timer = setInterval(() => {
      setRelogioMs(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const agoraMs = Math.max(relogioMs, ultima.recebidoEmMs);
  const agoraData = new Date(agoraMs);
  const online = centralEstaOnline(leitura, agoraMs);
  // Sem resposta válida (carregando ou erro), não se sabe se a central está ligada: mostra "--", não zero
  const statusDesconhecido = !!dispositivoId && estadoLeitura !== 'pronto';
  // Consumo do período, médias, previsão e linha de base combinam histórico bruto + diário
  const dispTotais = disponibilidade(bruto, diario);
  const totaisDisponiveis = exibivel(dispTotais);
  const totaisDesatualizados = dispTotais === 'desatualizado';
  // O gráfico usa somente o histórico bruto e continua disponível se apenas o diário falhar
  const dispGrafico = disponibilidade(bruto);
  const graficoDisponivel = exibivel(dispGrafico);
  const mensagemSemGrafico = dispGrafico === 'indisponivel' ? 'Histórico indisponível no momento.' : 'Carregando seu histórico...';
  const leiturasParaCalculo = leitura ? [...historico, leitura] : historico;

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

  const statusBaseline = calcularStatusBaseline(
    historicoDiario,
    aguaHojeNum,
    energiaHojeNum,
    leiturasParaCalculo
  );

  // Consumo acumulado real do periodo selecionado (Dia / Semana / Mes / Ano)
  const rotuloConsumoPeriodo = obterRotuloConsumoPorPeriodo(periodo);
  const consumoPeriodoLitros = calcularConsumoPorPeriodo(
    leiturasParaCalculo,
    periodo,
    'consumo_agua_litros',
    historicoDiario,
    agoraData
  ).toFixed(1);
  const consumoPeriodoTexto = totaisDisponiveis ? consumoPeriodoLitros : '--';

  const vazaoLMin = statusDesconhecido ? '--' : online && leitura ? Number(leitura.vazao_l_min).toFixed(1) : '0.0';
  const previsaoMesLitros = totaisDisponiveis ? (statusBaseline.mediaAguaLitrosDia * 30).toFixed(0) : '--';

  // Calcula medias reais do historico
  const mediaDiariaLitros = totaisDisponiveis ? statusBaseline.mediaAguaLitrosDia.toFixed(1) : '--';

  const barras = montarBarrasPorPeriodo(historico, periodo, 'vazao_l_min', agoraData);
  const maiorValor = Math.max(...barras.map(barra => barra.valor ?? 0), 1);


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.conteudo}>

          <CabecalhoTela
            titulo="Água"
            subtitulo="Sensor de vazão YF-S201"
            onVoltar={() => router.push('/')}
            acao={{ icone: 'notifications-outline', rotulo: 'Alertas', onPress: () => router.push('/alertas') }}
          />

          {/* Aviso de falha nas consultas de leituras (com opção de tentar novamente) */}
          <AvisoFalhaLeituras fontes={leituras.fontes} onTentarNovamente={leituras.tentarNovamente} />

          <SeletorSegmentado
            rotuloGrupo="Período"
            cor={ACENTO}
            ativo={periodo}
            opcoes={(['dia', 'semana', 'mes', 'ano'] as const).map((item) => ({
              chave: item,
              rotulo: item === 'mes' ? 'Mês' : item.charAt(0).toUpperCase() + item.slice(1),
              bloqueado: (item === 'mes' || item === 'ano') && !possuiPlus
            }))}
            onSelecionar={(item) => {
              const restritoPlus = (item === 'mes' || item === 'ano') && !possuiPlus;
              if (restritoPlus) {
                setAvisoUpgrade(true);
                return;
              }
              setAvisoUpgrade(false);
              setPeriodo(item);
            }}
          />

          {avisoUpgrade && !possuiPlus && (
            <CartaoUpgrade
              titulo="Relatórios Mensais e Anuais (Plano Plus)"
              descricao="O plano Básico inclui relatórios diários e semanais. Faça upgrade para o HomeWise Plus para desbloquear o histórico completo de Mês e Ano."
              acao="Conhecer plano Plus"
              onPress={() => router.push('/gerenciar-assinatura')}
            />
          )}

          {/* Destaque: consumo do período selecionado */}
          <View style={styles.destaque}>
            <View style={styles.destaqueBrilho} />
            <View style={styles.destaqueTopo}>
              <View style={styles.destaqueIcone}>
                <Ionicons name="water" size={18} color={ACENTO} />
              </View>
              <Text style={styles.labelConsumo}>{rotuloConsumoPeriodo}</Text>
            </View>
            <Text style={styles.valorConsumo} accessibilityLabel={`${rotuloConsumoPeriodo}: ${consumoPeriodoTexto} litros`}>
              {consumoPeriodoTexto}<Text style={styles.unidade}> L</Text>
            </Text>
            <SeloDesatualizado visivel={totaisDesatualizados} />
            <View style={styles.linhaInfo}>
              <View style={styles.infoBloco}>
                <Ionicons name="speedometer-outline" size={15} color={ACENTO} />
                <Text style={styles.infoLabel}>Vazão instantânea</Text>
                <Text style={styles.infoValor}>{vazaoLMin} <Text style={styles.infoUnidade}>L/min</Text></Text>
              </View>
              <View style={styles.infoBloco}>
                <Ionicons name="trending-up-outline" size={15} color={ACENTO} />
                <Text style={styles.infoLabel}>Projeção mensal</Text>
                <Text style={styles.infoValor}>{previsaoMesLitros} <Text style={styles.infoUnidade}>L</Text></Text>
              </View>
            </View>
          </View>

          {/* Gráfico de barras por período */}
          <View style={styles.card}>
            <Text style={styles.tituloGrafico}>Vazão média por período (L/min)</Text>
            <Text style={styles.legenda}>{graficoDisponivel ? 'Períodos sem leituras ficam sem barra.' : mensagemSemGrafico}</Text>
            <SeloDesatualizado visivel={dispGrafico === 'desatualizado'} />
            {graficoDisponivel && (
              <View style={{ marginTop: 14 }}>
                <GraficoBarras barras={barras} maior={maiorValor} cor={ACENTO} casas={1} chaveAnimacao={periodo} />
              </View>
            )}
          </View>

          {/* Resumo e médias */}
          <View style={styles.card}>
            <View style={styles.resumoHeader}>
              <View>
                <Text style={styles.resumoTitulo}>Estatísticas Reais</Text>
                <SeloDesatualizado visivel={totaisDesatualizados} />
              </View>
              <TouchableOpacity onPress={() => router.push('/')} accessibilityRole="link" hitSlop={8} style={styles.linkBotao}>
                <Text style={styles.resumoLink}>Ver no painel</Text>
                <Ionicons name="chevron-forward" size={14} color={C.marca} />
              </TouchableOpacity>
            </View>
            <LinhaResumo icone="analytics-outline" rotulo="Média diária aprendida" valor={`${mediaDiariaLitros} L/dia`} />
            <LinhaResumo
              icone={statusBaseline.fase === 'calibrado' ? 'sparkles-outline' : 'hourglass-outline'}
              rotulo="Linha de Base"
              valor={!totaisDisponiveis ? '--' : statusBaseline.fase === 'calibrado' ? 'Calibrado' : `Aprendizado (${statusBaseline.diasRegistrados}/30 d)`}
              cor={statusBaseline.fase === 'calibrado' ? C.ok : ACENTO}
            />
            <LinhaResumo icone="calendar-outline" rotulo="Previsão mensal" valor={`${previsaoMesLitros} L`} ultima />
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ACENTO = C.agua;

const styles = criarEstilosConsumo(ACENTO);
