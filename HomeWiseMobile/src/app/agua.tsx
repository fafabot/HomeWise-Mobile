import React, { useState } from 'react';
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

export default function AguaScreen() {
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'ano'>('dia');

  const barrasAgua = [
    { hora: '00h', valor: 30 },
    { hora: '04h', valor: 10 },
    { hora: '08h', valor: 120 },
    { hora: '12h', valor: 85 },
    { hora: '16h', valor: 60 },
    { hora: '20h', valor: 140 },
    { hora: '24h', valor: 45 }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Água</Text>
          <TouchableOpacity style={styles.botaoSino} activeOpacity={0.7}>
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

        {/* Card Principal de Agua */}
        <View style={styles.cardAguaPrincipal}>
          <View style={styles.cardTopoLinha}>
            <Ionicons name="water" size={18} color="#38bdf8" />
            <Text style={styles.labelConsumo}>Consumo hoje</Text>
          </View>
          <Text style={styles.valorConsumo}>4.250 <Text style={styles.unidade}>L</Text></Text>
          <View style={styles.linhaInfo}>
            <View>
              <Text style={styles.infoLabel}>Vazão instantânea</Text>
              <Text style={styles.infoValor}>12,4 L/min</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>Previsão do mês</Text>
              <Text style={styles.infoValor}>9.600 L</Text>
            </View>
          </View>
        </View>

        {/* Grafico de Barras */}
        <View style={styles.cardGrafico}>
          <Text style={styles.tituloGrafico}>Consumo diário (L)</Text>
          <View style={styles.graficoContainer}>
            {barrasAgua.map((barra, index) => {
              const alturaPorcentagem = (barra.valor / 150) * 120;
              return (
                <View key={index} style={styles.colunaBarra}>
                  <View style={[styles.barraPreenchida, { height: alturaPorcentagem }]} />
                  <Text style={styles.labelHora}>{barra.hora}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Resumo e Medias */}
        <View style={styles.cardResumo}>
          <View style={styles.resumoHeader}>
            <Text style={styles.resumoTitulo}>Resumo</Text>
            <TouchableOpacity>
              <Text style={styles.resumoLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Média diária</Text>
            <Text style={styles.resumoValor}>312 L</Text>
          </View>
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Média dos últimos 7 dias</Text>
            <Text style={styles.resumoValor}>335 L</Text>
          </View>
          <View style={[styles.resumoLinha, { borderBottomWidth: 0 }]}>
            <Text style={styles.resumoLabel}>Mês anterior</Text>
            <Text style={styles.resumoValor}>8.950 L</Text>
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
