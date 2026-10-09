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
import { observarUltimaLeitura, observarHistorico, Leitura } from '@/services/leiturasService';

export default function EnergiaScreen() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'ano'>('dia');
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [historico, setHistorico] = useState<Leitura[]>([]);

  useEffect(() => {
    const unsubLeitura = observarUltimaLeitura((dados) => {
      setLeitura(dados);
    });

    const unsubHistorico = observarHistorico((dados) => {
      setHistorico(dados);
    });

    return () => {
      unsubLeitura();
      unsubHistorico();
    };
  }, []);

  // Dados reais
  const energiaHoje = leitura ? Number(leitura.energia_kwh).toFixed(2) : '0.00';
  const potenciaKw = leitura ? (Number(leitura.potencia_w) / 1000).toFixed(2) : '0.00';
  const previsaoMes = (Number(energiaHoje) * 30).toFixed(1);

  // Calcula medias reais do historico
  const mediaDiaria = historico.length > 0
    ? (historico.reduce((acc, c) => acc + c.energia_kwh, 0) / historico.length).toFixed(2)
    : energiaHoje;

  // Monta barras dinâmicas a partir das ultimas leituras do Firestore
  const barras = historico.length >= 7
    ? historico.slice(-7).map((item, idx) => ({
        hora: new Date(item.criado_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        valor: Math.max(item.potencia_w / 200, 1) // escala para visualizacao
      }))
    : [
        { hora: '00h', valor: 2 },
        { hora: '04h', valor: 1.5 },
        { hora: '08h', valor: 7 },
        { hora: '12h', valor: 4.5 },
        { hora: '16h', valor: 3.5 },
        { hora: '20h', valor: 9.5 },
        { hora: 'Agora', valor: leitura ? Math.max((leitura.potencia_w / 200), 1.5) : 5 }
      ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
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
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Card Principal de Energia Conectado ao PZEM-004T */}
        <View style={styles.cardEnergiaPrincipal}>
          <View style={styles.cardTopoLinha}>
            <Ionicons name="flash" size={18} color="#86efac" />
            <Text style={styles.labelConsumo}>Consumo medido hoje</Text>
          </View>
          <Text style={styles.valorConsumo}>{energiaHoje} <Text style={styles.unidade}>kWh</Text></Text>
          <View style={styles.linhaInfo}>
            <View>
              <Text style={styles.infoLabel}>Potência instantânea</Text>
              <Text style={styles.infoValor}>{potenciaKw} kW ({leitura?.potencia_w?.toFixed(0) || '0'} W)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>Tensão na rede</Text>
              <Text style={styles.infoValor}>{leitura?.tensao_v?.toFixed(1) || '0'} V</Text>
            </View>
          </View>
        </View>

        {/* Grafico de Barras Dinâmico */}
        <View style={styles.cardGrafico}>
          <Text style={styles.tituloGrafico}>Padrão de potência nas últimas leituras</Text>
          <View style={styles.graficoContainer}>
            {barras.map((barra, index) => {
              const alturaPorcentagem = Math.min((barra.valor / 10) * 120, 130);
              return (
                <View key={index} style={styles.colunaBarra}>
                  <View style={[styles.barraPreenchida, { height: Math.max(alturaPorcentagem, 12) }]} />
                  <Text style={styles.labelHora}>{barra.hora}</Text>
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
            <Text style={styles.resumoLabel}>Média diária calculada</Text>
            <Text style={styles.resumoValor}>{mediaDiaria} kWh</Text>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Previsão para 30 dias</Text>
            <Text style={styles.resumoValor}>{previsaoMes} kWh</Text>
          </View>
          <View style={[styles.resumoLinha, { borderBottomWidth: 0 }]}>
            <Text style={styles.resumoLabel}>Total de medições recebidas</Text>
            <Text style={styles.resumoValor}>{historico.length}</Text>
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
