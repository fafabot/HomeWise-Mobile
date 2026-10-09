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
import { observarUltimaLeitura, Leitura } from '@/services/leiturasService';

export default function HomeScreen() {
  const [leitura, setLeitura] = useState<Leitura | null>(null);

  useEffect(() => {
    const unsubscribe = observarUltimaLeitura((dados) => {
      setLeitura(dados);
    });
    return () => unsubscribe();
  }, []);

  const aguaLitros = leitura ? leitura.consumo_agua_litros.toFixed(0) : '342';
  const energiaKwh = leitura ? leitura.energia_kwh.toFixed(1) : '8,7';
  const potenciaW = leitura ? leitura.potencia_w.toFixed(0) : '1350';

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
          <TouchableOpacity style={styles.botaoSino} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Linha dos Cards de Agua e Energia */}
        <View style={styles.rowCards}>
          {/* Card Agua */}
          <View style={[styles.miniCard, styles.cardAgua]}>
            <View style={styles.miniCardTopo}>
              <Ionicons name="water" size={16} color="#38bdf8" />
              <Text style={styles.miniCardLabel}>Água hoje</Text>
            </View>
            <Text style={styles.miniCardValor}>{aguaLitros} L</Text>
            <Text style={styles.miniCardSub}>8.240 L este mês</Text>
          </View>

          {/* Card Energia */}
          <View style={[styles.miniCard, styles.cardEnergia]}>
            <View style={styles.miniCardTopo}>
              <Ionicons name="flash" size={16} color="#4ade80" />
              <Text style={styles.miniCardLabel}>Energia hoje</Text>
            </View>
            <Text style={styles.miniCardValor}>{energiaKwh} kWh</Text>
            <Text style={styles.miniCardSub}>218 kWh este mês</Text>
          </View>
        </View>

        {/* Card Total Previsto */}
        <View style={styles.cardTotalPrevisto}>
          <View>
            <Text style={styles.totalPrevistoLabel}>Total previsto</Text>
            <Text style={styles.totalPrevistoValor}>R$ 480,00</Text>
            <View style={styles.linhaVariacao}>
              <Ionicons name="trending-up" size={14} color="#22c55e" />
              <Text style={styles.totalPrevistoSub}> 12% em relação ao mês anterior</Text>
            </View>
          </View>
          <View style={styles.circuloCifrao}>
            <Ionicons name="cash-outline" size={24} color="#ffffff" />
          </View>
        </View>

        {/* Card Situacao Geral */}
        <TouchableOpacity style={styles.cardSituacao} activeOpacity={0.8}>
          <View style={styles.situacaoEsquerda}>
            <View style={styles.checkIconBox}>
              <Ionicons name="checkmark" size={18} color="#07131b" />
            </View>
            <View>
              <Text style={styles.situacaoLabel}>Situação geral</Text>
              <Text style={styles.situacaoStatus}>Consumo dentro do esperado</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#86efac" />
        </TouchableOpacity>

        {/* Sessao Alertas Ativos */}
        <View style={styles.secaoHeader}>
          <Text style={styles.secaoTitulo}>Alertas ativos</Text>
          <TouchableOpacity>
            <Text style={styles.secaoLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {/* Card Alerta de Vazamento */}
        <TouchableOpacity style={styles.cardAlerta} activeOpacity={0.8}>
          <View style={styles.alertaIconeBox}>
            <Ionicons name="warning" size={20} color="#f87171" />
          </View>
          <View style={styles.alertaConteudo}>
            <Text style={styles.alertaTitulo}>Possível vazamento</Text>
            <Text style={styles.alertaSub}>Banheiro • Hoje, 08:30</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#f87171" />
        </TouchableOpacity>

        {/* Card Medição Instantânea em Tempo Real */}
        <View style={styles.cardTempoReal}>
          <View style={styles.tempoRealHeader}>
            <View style={styles.linhaCentral}>
              <Ionicons name="hardware-chip-outline" size={16} color="#64748b" />
              <Text style={styles.tempoRealTitulo}>CENTRAL HOMEWISE</Text>
            </View>
            <View style={styles.badgeLive}>
              <View style={styles.pontoLive} />
              <Text style={styles.badgeLiveTexto}>CONECTADA</Text>
            </View>
          </View>
          <View style={styles.tempoRealValores}>
            <View style={styles.itemMedicao}>
              <Text style={styles.medicaoLabel}>Vazão</Text>
              <Text style={styles.medicaoValor}>{leitura ? leitura.vazao_l_min.toFixed(1) : '0.0'} <Text style={styles.medicaoUnid}>L/min</Text></Text>
            </View>
            <View style={styles.itemMedicao}>
              <Text style={styles.medicaoLabel}>Potência</Text>
              <Text style={styles.medicaoValor}>{potenciaW} <Text style={styles.medicaoUnid}>W</Text></Text>
            </View>
            <View style={styles.itemMedicao}>
              <Text style={styles.medicaoLabel}>Tensão</Text>
              <Text style={styles.medicaoValor}>{leitura ? leitura.tensao_v.toFixed(0) : '127'} <Text style={styles.medicaoUnid}>V</Text></Text>
            </View>
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
    borderColor: '#1e3a4b'
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
    alignItems: 'center'
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
  cardAlerta: {
    backgroundColor: '#261414',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d'
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
  pontoLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e'
  },
  badgeLiveTexto: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: 'bold'
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
  }
});
