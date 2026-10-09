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

export default function AguaScreen() {
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

  // Dados reais do sensor YF-S201
  const litrosHoje = leitura ? Number(leitura.consumo_agua_litros).toFixed(1) : '0.0';
  const vazaoLMin = leitura ? Number(leitura.vazao_l_min).toFixed(1) : '0.0';
  const previsaoMesLitros = (Number(litrosHoje) * 30).toFixed(0);

  // Calcula medias reais do historico
  const mediaDiariaLitros = historico.length > 0
    ? (historico.reduce((acc, c) => acc + c.consumo_agua_litros, 0) / historico.length).toFixed(1)
    : litrosHoje;

  // Monta barras dinâmicas a partir das ultimas leituras do sensor
  const barras = historico.length >= 7
    ? historico.slice(-7).map((item) => ({
        hora: new Date(item.criado_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        valor: Math.max(item.vazao_l_min * 10, 5) // escala visual
      }))
    : [
        { hora: '00h', valor: 10 },
        { hora: '04h', valor: 5 },
        { hora: '08h', valor: 45 },
        { hora: '12h', valor: 30 },
        { hora: '16h', valor: 20 },
        { hora: '20h', valor: 55 },
        { hora: 'Agora', valor: leitura ? Math.max(leitura.vazao_l_min * 10, 8) : 15 }
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
          <Text style={styles.tituloHeader}>Água</Text>
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

        {/* Card Principal de Agua Conectado ao YF-S201 */}
        <View style={styles.cardAguaPrincipal}>
          <View style={styles.cardTopoLinha}>
            <Ionicons name="water" size={18} color="#38bdf8" />
            <Text style={styles.labelConsumo}>Consumo medido hoje</Text>
          </View>
          <Text style={styles.valorConsumo}>{litrosHoje} <Text style={styles.unidade}>L</Text></Text>
          <View style={styles.linhaInfo}>
            <View>
              <Text style={styles.infoLabel}>Vazão instantânea</Text>
              <Text style={styles.infoValor}>{vazaoLMin} L/min</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>Projeção mensal</Text>
              <Text style={styles.infoValor}>{previsaoMesLitros} L</Text>
            </View>
          </View>
        </View>

        {/* Grafico de Barras Dinâmico */}
        <View style={styles.cardGrafico}>
          <Text style={styles.tituloGrafico}>Atividade de fluxo de água nas últimas leituras</Text>
          <View style={styles.graficoContainer}>
            {barras.map((barra, index) => {
              const alturaPorcentagem = Math.min((barra.valor / 70) * 120, 130);
              return (
                <View key={index} style={styles.colunaBarra}>
                  <View style={[styles.barraPreenchida, { height: Math.max(alturaPorcentagem, 12) }]} />
                  <Text style={styles.labelHora}>{barra.hora}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Resumo e Medias */}
        <View style={styles.cardResumo}>
          <View style={styles.resumoHeader}>
            <Text style={styles.resumoTitulo}>Estatísticas Reais</Text>
            <TouchableOpacity onPress={() => router.push('/')}>
              <Text style={styles.resumoLink}>Ver no painel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Média diária calculada</Text>
            <Text style={styles.resumoValor}>{mediaDiariaLitros} L</Text>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Previsão para 30 dias</Text>
            <Text style={styles.resumoValor}>{previsaoMesLitros} L</Text>
          </View>
          <View style={[styles.resumoLinha, { borderBottomWidth: 0 }]}>
            <Text style={styles.resumoLabel}>Total de medições registradas</Text>
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
  cardAguaPrincipal: {
    backgroundColor: '#0c2738',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#164e63',
    marginBottom: 16
  },
  cardTopoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  labelConsumo: {
    color: '#38bdf8',
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
    backgroundColor: '#22b7d4',
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
