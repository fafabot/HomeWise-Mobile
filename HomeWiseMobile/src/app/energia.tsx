import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  observarUltimaLeitura,
  observarHistorico,
  centralEstaOnline,
  Leitura
} from '@/services/leiturasService';
import {
  observarHistoricoDiario,
  calcularStatusBaseline,
  ConsumoDiario
} from '@/services/baselineService';

import { useAuth } from '@/contexts/AuthContext';
import {
  montarBarrasPorPeriodo,
  calcularConsumoPorPeriodo,
  obterRotuloConsumoPorPeriodo
} from '@/utils/grafico-periodos';

export default function EnergiaScreen() {
  const router = useRouter();
  const { dispositivoId } = useAuth();
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'ano'>('dia');
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [historico, setHistorico] = useState<Leitura[]>([]);
  const [historicoDiario, setHistoricoDiario] = useState<ConsumoDiario[]>([]);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setAgoraMs(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubLeitura = observarUltimaLeitura((dados) => {
      setLeitura(dados);
      setAgoraMs(Date.now());
    }, dispositivoId);

    const unsubHistorico = observarHistorico((dados) => {
      setHistorico(dados);
    }, null, dispositivoId);

    const unsubDiario = observarHistoricoDiario((dados) => {
      setHistoricoDiario(dados);
    }, dispositivoId);

    return () => {
      unsubLeitura();
      unsubHistorico();
      unsubDiario();
    };
  }, [dispositivoId]);

  const agoraData = new Date(agoraMs);
  const online = centralEstaOnline(leitura, agoraMs);
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
  const consumoPeriodoKwh = calcularConsumoPorPeriodo(
    leiturasParaCalculo,
    periodo,
    'energia_kwh',
    historicoDiario,
    agoraData
  ).toFixed(2);

  // Dados reais (potência e tensão instantâneas zeram quando a central está desligada)
  const potenciaKw = online && leitura ? (Number(leitura.potencia_w) / 1000).toFixed(2) : '0.00';
  const potenciaW = online && leitura ? leitura.potencia_w.toFixed(0) : '0';
  const tensaoV = online && leitura ? leitura.tensao_v.toFixed(1) : '0.0';
  const previsaoMes = (statusBaseline.mediaEnergiaKwhDia * 30).toFixed(1);

  // Calcula medias reais do historico
  const mediaDiaria = statusBaseline.mediaEnergiaKwhDia.toFixed(2);

  const barras = montarBarrasPorPeriodo(historico, periodo, 'potencia_w', agoraData);
  const maiorValor = Math.max(...barras.map(barra => barra.valor ?? 0), 1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7} onPress={() => router.push('/')}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Energia</Text>
          <TouchableOpacity style={styles.botaoSino} activeOpacity={0.7} onPress={() => router.push('/alertas')}>
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Botoes de Periodo */}
        <View style={styles.periodoBarra}>
          {(['dia', 'semana', 'mes', 'ano'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.periodoBotao, periodo === item && styles.periodoBotaoAtivo]}
              onPress={() => setPeriodo(item)}
            >
              <Text style={[styles.periodoTexto, periodo === item && styles.periodoTextoAtivo]}>
                {item === 'mes' ? 'Mês' : item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Card Principal de Energia Conectado ao PZEM-004T */}
        <View style={styles.cardEnergiaPrincipal}>
          <View style={styles.cardTopoLinha}>
            <Ionicons name="flash" size={18} color="#86efac" />
            <Text style={styles.labelConsumo}>{rotuloConsumoPeriodo}</Text>
          </View>
          <Text style={styles.valorConsumo}>{consumoPeriodoKwh} <Text style={styles.unidade}>kWh</Text></Text>
          <View style={styles.linhaInfo}>
            <View>
              <Text style={styles.infoLabel}>Potência instantânea</Text>
              <Text style={styles.infoValor}>{potenciaKw} kW ({potenciaW} W)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>Tensão na rede</Text>
              <Text style={styles.infoValor}>{tensaoV} V</Text>
            </View>
          </View>
        </View>

        {/* Grafico de Barras Dinâmico */}
        <View style={styles.cardGrafico}>
          <Text style={styles.tituloGrafico}>Potência média por período (W)</Text>
          <Text style={styles.labelHora}>Períodos sem leituras ficam sem barra.</Text>
          <View style={styles.graficoContainer}>
            {barras.map((barra, index) => {
              const alturaPorcentagem = ((barra.valor ?? 0) / maiorValor) * 100;
              return (
                <View key={index} style={styles.colunaBarra} accessibilityLabel={`${barra.label}: ${barra.valor === null ? 'sem leituras' : barra.valor.toFixed(1)}`}>
                  <View style={[styles.barraPreenchida, { height: barra.valor === null ? 0 : Math.max(alturaPorcentagem, 4) }]} />
                  <Text style={styles.labelHora}>{barra.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Resumo e Medias Calculadas */}
        <View style={styles.cardResumo}>
          <View style={styles.resumoHeader}>
            <Text style={styles.resumoTitulo}>Estatísticas Reais</Text>
            <TouchableOpacity onPress={() => router.push('/')}>
              <Text style={styles.resumoLink}>Ver no painel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Média diária aprendida</Text>
            <Text style={styles.resumoValor}>{mediaDiaria} kWh/dia</Text>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Linha de Base</Text>
            <Text style={[styles.resumoValor, { color: statusBaseline.fase === 'calibrado' ? '#22c55e' : '#38bdf8' }]}>
              {statusBaseline.fase === 'calibrado' ? 'Calibrado' : `Aprendizado (${statusBaseline.diasRegistrados}/30 d)`}
            </Text>
          </View>
          <View style={[styles.resumoLinha, { borderBottomWidth: 0 }]}>
            <Text style={styles.resumoLabel}>Previsão mensal</Text>
            <Text style={styles.resumoValor}>{previsaoMes} kWh</Text>
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
  botaoVoltar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0e222e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a4b'
  },
  botaoSino: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0e222e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a4b'
  },
  tituloHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  periodoBarra: {
    flexDirection: 'row',
    backgroundColor: '#0a1a24',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16
  },
  periodoBotao: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  periodoBotaoAtivo: {
    backgroundColor: '#0284c7'
  },
  periodoTexto: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },
  periodoTextoAtivo: {
    color: '#ffffff'
  },
  cardEnergiaPrincipal: {
    backgroundColor: '#0d2d24',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#065f46',
    marginBottom: 16
  },
  cardTopoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  labelConsumo: {
    color: '#86efac',
    fontSize: 13,
    fontWeight: '500'
  },
  valorConsumo: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: 'bold',
    marginVertical: 6
  },
  unidade: {
    fontSize: 20,
    color: '#cbd5e1',
    fontWeight: 'normal'
  },
  linhaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  infoValor: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2
  },
  cardGrafico: {
    backgroundColor: '#0b1d28',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#133547',
    marginBottom: 16
  },
  tituloGrafico: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '500'
  },
  graficoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingBottom: 6
  },
  colunaBarra: {
    alignItems: 'center',
    flex: 1
  },
  barraPreenchida: {
    width: 14,
    backgroundColor: '#22c55e',
    borderRadius: 6,
    marginBottom: 8
  },
  labelHora: {
    color: '#64748b',
    fontSize: 10
  },
  cardResumo: {
    backgroundColor: '#0b1d28',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#133547'
  },
  resumoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  resumoTitulo: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold'
  },
  resumoLink: {
    color: '#0284c7',
    fontSize: 12
  },
  resumoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#132838'
  },
  resumoLabel: {
    color: '#94a3b8',
    fontSize: 13
  },
  resumoValor: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
