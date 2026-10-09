import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar
} from "react-native";
import { observarUltimaLeitura } from "./leiturasService";
import { deslogarUsuario } from "./authService";

export default function DashboardScreen({ user }) {
  const [leitura, setLeitura] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Registra o listener em tempo real no Firestore
    const unsubscribe = observarUltimaLeitura((dados) => {
      setLeitura(dados);
      setCarregando(false);
    });

    // Limpa o listener ao desmontar a tela
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1f2a" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Topo / Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>HomeWise • Monitoramento</Text>
            <Text style={styles.headerTitle}>Olá, {user?.email?.split("@")[0] || "Morador"}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={deslogarUsuario}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {carregando ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#22b7d4" />
            <Text style={styles.loadingText}>Conectando à Central HomeWise...</Text>
          </View>
        ) : !leitura ? (
          <View style={styles.cardAviso}>
            <Text style={styles.avisoTitulo}>Aguardando primeira leitura</Text>
            <Text style={styles.avisoTexto}>
              Ligue a Central ESP8266 na tomada para iniciar a transmissão das medições de água e energia.
            </Text>
          </View>
        ) : (
          <>
            {/* Card de Agua */}
            <View style={[styles.card, styles.cardAgua]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitulo}>💧 Consumo de Água</Text>
                <Text style={styles.badgeAoVivo}>AO VIVO</Text>
              </View>
              <Text style={styles.valorGrande}>
                {Number(leitura.consumo_agua_litros || 0).toFixed(1)} <Text style={styles.unidade}>L</Text>
              </Text>
              <Text style={styles.subDado}>
                Vazão atual: {Number(leitura.vazao_l_min || 0).toFixed(1)} L/min
              </Text>
            </View>

            {/* Card de Energia */}
            <View style={[styles.card, styles.cardEnergia]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitulo}>⚡ Consumo de Energia</Text>
                <Text style={styles.badgeAoVivo}>AO VIVO</Text>
              </View>
              <Text style={styles.valorGrande}>
                {Number(leitura.energia_kwh || 0).toFixed(2)} <Text style={styles.unidade}>kWh</Text>
              </Text>
              <View style={styles.linhaInfo}>
                <Text style={styles.subDado}>
                  Potência: {Number(leitura.potencia_w || 0).toFixed(0)} W
                </Text>
                <Text style={styles.subDado}>
                  Tensão: {Number(leitura.tensao_v || 0).toFixed(1)} V
                </Text>
              </View>
            </View>

            {/* Status do Dispositivo */}
            <View style={styles.cardStatus}>
              <Text style={styles.statusTitulo}>Central HomeWise Conectada</Text>
              <Text style={styles.statusId}>Dispositivo: {leitura.dispositivo_id}</Text>
              <Text style={styles.statusHora}>
                Última atualização: {new Date(leitura.criado_em).toLocaleTimeString("pt-BR")}
              </Text>
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07131b"
  },
  scrollContent: {
    padding: 20
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },
  headerSubtitle: {
    color: "#8aa0ad",
    fontSize: 13,
    textTransform: "uppercase"
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold"
  },
  logoutButton: {
    backgroundColor: "#162e3d",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  logoutText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600"
  },
  centerBox: {
    marginTop: 60,
    alignItems: "center"
  },
  loadingText: {
    color: "#8aa0ad",
    marginTop: 14,
    fontSize: 15
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16
  },
  cardAgua: {
    backgroundColor: "#0d2b38",
    borderWidth: 1,
    borderColor: "#18a8c3"
  },
  cardEnergia: {
    backgroundColor: "#0d2e26",
    borderWidth: 1,
    borderColor: "#21b978"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  cardTitulo: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold"
  },
  badgeAoVivo: {
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  valorGrande: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "bold"
  },
  unidade: {
    fontSize: 20,
    color: "#cbd5e1",
    fontWeight: "normal"
  },
  subDado: {
    color: "#cbd5e1",
    fontSize: 14,
    marginTop: 8
  },
  linhaInfo: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardStatus: {
    backgroundColor: "#0e222e",
    borderRadius: 12,
    padding: 16,
    marginTop: 8
  },
  statusTitulo: {
    color: "#4ade80",
    fontWeight: "bold",
    fontSize: 14
  },
  statusId: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4
  },
  statusHora: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2
  },
  cardAviso: {
    backgroundColor: "#162e3d",
    padding: 20,
    borderRadius: 12,
    marginTop: 20
  },
  avisoTitulo: {
    color: "#f59e0b",
    fontSize: 16,
    fontWeight: "bold"
  },
  avisoTexto: {
    color: "#cbd5e1",
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20
  }
});

