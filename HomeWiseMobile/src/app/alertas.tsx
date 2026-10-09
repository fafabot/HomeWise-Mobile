import React from 'react';
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

export default function AlertasScreen() {
  const alertas: {
    id: number;
    tipo: string;
    titulo: string;
    local: string;
    descricao: string;
    icone: keyof typeof Ionicons.glyphMap;
    corBorda: string;
    corFundo: string;
    corTexto: string;
  }[] = [
    {
      id: 1,
      tipo: 'critico',
      titulo: 'Possível vazamento',
      local: 'Banheiro • Hoje, 08:30',
      descricao: 'Consumo 45% acima do padrão detectado nas últimas 2 horas.',
      icone: 'warning',
      corBorda: '#7f1d1d',
      corFundo: '#261414',
      corTexto: '#f87171'
    },
    {
      id: 2,
      tipo: 'aviso',
      titulo: 'Consumo acima da média',
      local: 'Energia • Ontem, 19:15',
      descricao: '14% acima do padrão habitual deste horário.',
      icone: 'flash',
      corBorda: '#854d0e',
      corFundo: '#2e2009',
      corTexto: '#facc15'
    },
    {
      id: 3,
      tipo: 'sucesso',
      titulo: 'Economia alcançada!',
      local: 'Residência • Você economizou',
      descricao: 'R$ 32,50 este mês em comparação com a meta definida.',
      icone: 'leaf',
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
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Alertas</Text>
          <TouchableOpacity style={styles.botaoSino} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtituloPagina}>Notificações e anomalias da sua residência</Text>

        {/* Lista de Alertas */}
        {alertas.map((alerta) => (
          <TouchableOpacity
            key={alerta.id}
            style={[styles.cardAlerta, { backgroundColor: alerta.corFundo, borderColor: alerta.corBorda }]}
            activeOpacity={0.8}
          >
            <View style={styles.alertaTopo}>
              <View style={styles.alertaTituloLinha}>
                <Ionicons name={alerta.icone} size={18} color={alerta.corTexto} />
                <Text style={[styles.tituloAlerta, { color: alerta.corTexto }]}>{alerta.titulo}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </View>
            <Text style={styles.localAlerta}>{alerta.local}</Text>
            <Text style={styles.descAlerta}>{alerta.descricao}</Text>
          </TouchableOpacity>
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
