import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLeiturasCentral } from '@/hooks/use-leituras-central';
import { centralEstaOnline, type Leitura } from '@/services/leiturasService';
import {
  obterParametrosCalibracaoHardware,
  rotuloPerfilAcesso,
  temPermissaoAdmin
} from '@/utils/permissoes';
import { C, LARGURA_MAXIMA, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

function formatarDataHora(data?: Date): string {
  if (!data) return 'Sem timestamp';
  const d = new Date(data);
  if (!Number.isFinite(d.getTime())) return 'Sem timestamp';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function PainelAdminScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId } = useAuth();
  const autorizado = temPermissaoAdmin(perfil);
  const rotuloPapel = rotuloPerfilAcesso(perfil);
  const parametros = obterParametrosCalibracaoHardware();

  const { leitura, historico, bruto } = useLeiturasCentral(
    user?.uid,
    autorizado ? dispositivoId : ''
  );
  const online = centralEstaOnline(leitura);
  const carregando = bruto.estado === 'carregando';

  if (!autorizado) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.conteudo}>
            <CabecalhoTela titulo="Painel Técnico" onVoltar={() => router.push('/perfil')} />

            <View style={styles.cardRestrito} accessibilityRole="alert">
              <View style={styles.iconeRestrito}>
                <Ionicons name="lock-closed" size={26} color={C.perigo} />
              </View>
              <Text style={styles.tituloRestrito}>Acesso Restrito — Permissão Insuficiente</Text>
              <Text style={styles.descricaoRestrito}>
                {`Seu perfil atual é ${rotuloPapel}. O Painel Administrativo e de Diagnóstico Técnico (RF04) é exclusivo para contas com permissão de Administrador ou Suporte Técnico.`}
              </Text>
              <TouchableOpacity
                style={styles.botaoVoltarRestrito}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => router.push('/perfil')}
              >
                <Ionicons name="arrow-back" size={16} color={C.texto} style={{ marginRight: 6 }} />
                <Text style={styles.textoBotaoVoltar}>Voltar ao Perfil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.conteudo}>
          <CabecalhoTela titulo="Diagnóstico Técnico" onVoltar={() => router.push('/perfil')} />

          {/* Cabeçalho de Status Administrativo */}
          <View style={styles.cardResumo}>
            <View style={styles.linhaTopoResumo}>
              <View style={styles.seloPapel}>
                <Ionicons name="shield-checkmark" size={14} color={C.marca} />
                <Text style={styles.textoSeloPapel}>{`Acesso: ${rotuloPapel}`}</Text>
              </View>
              <View style={[styles.seloConexao, online ? styles.seloOnline : styles.seloOffline]}>
                <View style={[styles.pontoStatus, { backgroundColor: online ? C.ok : C.alerta }]} />
                <Text style={[styles.textoSeloConexao, { color: online ? C.ok : C.alerta }]}>
                  {online ? 'Central Online' : 'Central Offline'}
                </Text>
              </View>
            </View>

            <Text style={styles.tituloResumo}>Painel Administrativo e Suporte (RF04)</Text>
            <Text style={styles.subtituloResumo}>
              {dispositivoId
                ? `Inspeção técnica vinculada à central "${dispositivoId}".`
                : 'Nenhuma central vinculada para inspeção em tempo real.'}
            </Text>
          </View>

          {/* Parâmetros de Calibração e Hardware */}
          <Text style={styles.tituloSecao}>PARÂMETROS DE CALIBRAÇÃO E HARDWARE</Text>
          <View style={styles.cardLista}>
            {parametros.map((item, idx) => (
              <View
                key={item.chave}
                style={[styles.itemParametro, idx === parametros.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.linhaParametroTopo}>
                  <Text style={styles.tituloParametro}>{item.titulo}</Text>
                  <Text style={styles.valorParametro}>{item.valor}</Text>
                </View>
                <Text style={styles.detalheParametro}>{item.detalhe}</Text>
              </View>
            ))}
          </View>

          {/* Inspeção de Pacotes Brutos do Firestore */}
          <Text style={styles.tituloSecao}>TELEMETRIA BRUTA (ÚLTIMOS PACOTES)</Text>
          <View style={styles.cardLista}>
            {carregando ? (
              <View style={styles.blocoVazio}>
                <ActivityIndicator color={C.marca} size="small" />
                <Text style={styles.textoVazio}>Carregando pacotes de telemetria...</Text>
              </View>
            ) : historico.length === 0 ? (
              <View style={styles.blocoVazio}>
                <Ionicons name="analytics-outline" size={22} color={C.textoTer} />
                <Text style={styles.textoVazio}>
                  Nenhum pacote bruto registrado para a central selecionada.
                </Text>
              </View>
            ) : (
              historico.slice(-6).reverse().map((pkt: Leitura, idx: number, arr: Leitura[]) => (
                <View
                  key={pkt.id || String(idx)}
                  style={[styles.itemPacote, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.linhaPacoteTopo}>
                    <Text style={styles.idPacote}>{`ID: ${pkt.id || 's/id'}`}</Text>
                    <Text style={styles.dataPacote}>{formatarDataHora(pkt.criado_em)}</Text>
                  </View>
                  <Text style={styles.metricasPacote}>
                    {`Água: ${Number(pkt.vazao_l_min || 0).toFixed(2)} L/min | Acum.: ${Number(pkt.consumo_agua_litros || 0).toFixed(1)} L`}
                  </Text>
                  <Text style={styles.metricasPacote}>
                    {`Energia: ${Number(pkt.potencia_w || 0).toFixed(0)} W | ${Number(pkt.energia_kwh || 0).toFixed(3)} kWh | ${Number(pkt.tensao_v || 0).toFixed(1)} V`}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fundo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  conteudo: { width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' },

  cardRestrito: {
    backgroundColor: C.superficie,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: alfa(C.perigo, 0.35),
    alignItems: 'center',
    marginTop: 12
  },
  iconeRestrito: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: alfa(C.perigo, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  tituloRestrito: {
    color: C.texto,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8
  },
  descricaoRestrito: {
    color: C.textoSec,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20
  },
  botaoVoltarRestrito: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.superficieAlta,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borda
  },
  textoBotaoVoltar: { color: C.texto, fontSize: 13, fontWeight: '700' },

  cardResumo: {
    backgroundColor: C.superficie,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borda,
    marginBottom: 4
  },
  linhaTopoResumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  seloPapel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: alfa(C.marca, 0.14),
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.35)
  },
  textoSeloPapel: { color: C.marca, fontSize: 12, fontWeight: '700' },
  seloConexao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1
  },
  seloOnline: {
    backgroundColor: alfa(C.ok, 0.12),
    borderColor: alfa(C.ok, 0.35)
  },
  seloOffline: {
    backgroundColor: alfa(C.alerta, 0.12),
    borderColor: alfa(C.alerta, 0.35)
  },
  pontoStatus: { width: 7, height: 7, borderRadius: 4 },
  textoSeloConexao: { fontSize: 12, fontWeight: '700' },
  tituloResumo: { color: C.texto, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  subtituloResumo: { color: C.textoSec, fontSize: 13, lineHeight: 18 },

  tituloSecao: {
    color: C.textoTer,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4
  },
  cardLista: {
    backgroundColor: C.superficie,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borda,
    overflow: 'hidden'
  },
  itemParametro: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borda
  },
  linhaParametroTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8
  },
  tituloParametro: { color: C.texto, fontSize: 14, fontWeight: '700', flex: 1 },
  valorParametro: { color: C.marca, fontSize: 13, fontWeight: '800' },
  detalheParametro: { color: C.textoSec, fontSize: 12, lineHeight: 17 },

  blocoVazio: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8
  },
  textoVazio: { color: C.textoSec, fontSize: 13, textAlign: 'center' },
  itemPacote: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borda
  },
  linhaPacoteTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  idPacote: { color: C.textoTer, fontSize: 11, fontWeight: '700' },
  dataPacote: { color: C.marca, fontSize: 11, fontWeight: '700' },
  metricasPacote: { color: C.texto, fontSize: 12, lineHeight: 18 }
});
