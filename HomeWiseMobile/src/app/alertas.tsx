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
import { observarUltimaLeitura, Leitura } from '@/services/leiturasService';

export default function AlertasScreen() {
  const router = useRouter();
  const [leitura, setLeitura] = useState<Leitura | null>(null);

  useEffect(() => {
    const unsub = observarUltimaLeitura((dados) => {
      setLeitura(dados);
    });
    return () => unsub();
  }, []);

  // Regras reais de anomalia baseadas nos sensores
  const vazamentoAtivo = leitura ? (leitura.vazao_l_min > 5.0 && leitura.consumo_agua_litros > 50) : false;
  const potenciaExcessiva = leitura ? (leitura.potencia_w > 3500) : false;
  const tensaoAnormal = leitura ? (leitura.tensao_v > 0 && (leitura.tensao_v < 100 || leitura.tensao_v > 140)) : false;

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
    {
      id: 4,
      tipo: 'sucesso',
      titulo: 'Monitoramento HomeWise Ativo',
      local: `Dispositivo ${leitura?.dispositivo_id || 'central_homewise_01'}`,
      descricao: leitura ? 'Os sensores de vazão e grandezas elétricas estão operando e transmitindo normalmente.' : 'Aguardando o primeiro envio de dados do ESP8266.',
      icone: 'shield-checkmark' as const,
      corBorda: '#14532d',
      corFundo: '#0b2419',
      corTexto: '#4ade80'
    }
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
          <Text style={styles.tituloHeader}>Alertas e Diagnóstico</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.subtituloPagina}>
          Regras de negócio e monitoramento contínuo da sua residência
        </Text>

        {/* Lista de Alertas Baseada no Estado Real dos Sensores */}
        {alertas.map((alerta) => (
          <View
            key={alerta.id}
            style={[styles.cardAlerta, { backgroundColor: alerta.corFundo, borderColor: alerta.corBorda }]}
          >
            <View style={styles.alertaTopo}>
              <View style={styles.alertaTituloLinha}>
                <Ionicons name={alerta.icone} size={18} color={alerta.corTexto} />
                <Text style={[styles.tituloAlerta, { color: alerta.corTexto }]}>{alerta.titulo}</Text>
              </View>
            </View>
            <Text style={styles.localAlerta}>{alerta.local}</Text>
            <Text style={styles.descAlerta}>{alerta.descricao}</Text>
          </View>
        ))}

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
    marginBottom: 8
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
  tituloHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  subtituloPagina: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 20
  },
  cardAlerta: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16
  },
  alertaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  alertaTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tituloAlerta: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  localAlerta: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8
  },
  descAlerta: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18
  }
});
