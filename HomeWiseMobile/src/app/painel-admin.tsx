import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLeiturasCentral } from '@/hooks/use-leituras-central';
import { centralEstaOnline, type Leitura } from '@/services/leiturasService';
import { listarCentraisAdmin, type ResumoCentralAdmin } from '@/services/adminService';
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

function diagnosticarTensao(tensaoV: number): { texto: string; cor: string } {
  if (tensaoV <= 0) return { texto: 'Sem leitura', cor: C.textoTer };
  if (tensaoV < 105 || (tensaoV > 140 && tensaoV < 195) || tensaoV > 245) {
    return { texto: 'Fora da faixa nominal', cor: C.alerta };
  }
  return { texto: 'Rede estável', cor: C.ok };
}

export default function PainelAdminScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId } = useAuth();
  const permissaoReal = temPermissaoAdmin(perfil);
  const [simulandoMorador, setSimulandoMorador] = useState(false);
  const autorizado = permissaoReal && !simulandoMorador;
  const rotuloPapel = simulandoMorador ? 'Morador (Simulação RF04)' : rotuloPerfilAcesso(perfil);
  const parametros = obterParametrosCalibracaoHardware();

  const [centralSelecionada, setCentralSelecionada] = useState<string>(
    dispositivoId || 'central_homewise_01'
  );
  const [buscaCentral, setBuscaCentral] = useState<string>('');
  const [centrais, setCentrais] = useState<ResumoCentralAdmin[]>([]);
  const [carregandoCentrais, setCarregandoCentrais] = useState<boolean>(false);

  const carregarListaCentrais = useCallback(async () => {
    if (!autorizado) return;
    setCarregandoCentrais(true);
    try {
      const lista = await listarCentraisAdmin(dispositivoId || 'central_homewise_01');
      setCentrais(lista);
      if (lista.length > 0 && !centralSelecionada) {
        setCentralSelecionada(lista[0].dispositivoId);
      }
    } finally {
      setCarregandoCentrais(false);
    }
  }, [autorizado, dispositivoId, centralSelecionada]);

  useEffect(() => {
    void carregarListaCentrais();
  }, [carregarListaCentrais]);

  const { leitura, historico, bruto } = useLeiturasCentral(
    user?.uid,
    autorizado ? centralSelecionada : ''
  );
  const online = centralEstaOnline(leitura);
  const carregando = bruto.estado === 'carregando';

  function handleInspecionarCodigoManual() {
    const codigo = buscaCentral.trim();
    if (!codigo) return;
    setCentralSelecionada(codigo);
    if (!centrais.some((c) => c.dispositivoId === codigo)) {
      setCentrais((atual) => [
        {
          dispositivoId: codigo,
          ultimaData: '',
          ultimoConsumoAguaLitros: 0,
          ultimaEnergiaKwh: 0,
          mediaTensaoV: 0,
          diasRegistrados: 0,
          usuariosVinculados: []
        },
        ...atual
      ]);
    }
    setBuscaCentral('');
  }

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
              <View style={styles.acoesRestrito}>
                {simulandoMorador && (
                  <TouchableOpacity
                    style={styles.botaoRestaurarAdmin}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    onPress={() => setSimulandoMorador(false)}
                  >
                    <Ionicons name="shield-checkmark-outline" size={16} color={C.marca} style={{ marginRight: 6 }} />
                    <Text style={styles.textoBotaoRestaurarAdmin}>Voltar para visão Admin</Text>
                  </TouchableOpacity>
                )}
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
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tensaoAtual = Number(leitura?.tensao_v || 0);
  const statusTensao = diagnosticarTensao(tensaoAtual);

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

            <Text style={styles.tituloResumo}>Verificação de Centrais e Suporte (RF04)</Text>
            <Text style={styles.subtituloResumo}>
              {`Inspecionando a central "${centralSelecionada}". Selecione outra central abaixo ou digite o código do dispositivo para verificar telemetria, sensores e moradores vinculados.`}
            </Text>

            <View style={styles.linhaAcoesTopo}>
              <TouchableOpacity
                style={styles.botaoSecundario}
                activeOpacity={0.75}
                accessibilityRole="button"
                onPress={() => void carregarListaCentrais()}
              >
                <Ionicons name="refresh-outline" size={15} color={C.marca} />
                <Text style={styles.textoBotaoSecundario}>
                  {carregandoCentrais ? 'Atualizando...' : 'Atualizar centrais'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoSimular}
                activeOpacity={0.75}
                accessibilityRole="button"
                onPress={() => setSimulandoMorador(true)}
              >
                <Ionicons name="eye-outline" size={15} color={C.textoSec} />
                <Text style={styles.textoBotaoSimular}>Simular visão Morador (RF04)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Verificação e Seleção de Centrais */}
          <Text style={styles.tituloSecao}>CENTRAIS HOMEWISE REGISTRADAS</Text>
          <View style={styles.cardBuscaCentral}>
            <View style={styles.linhaInputCentral}>
              <Ionicons name="hardware-chip-outline" size={18} color={C.textoTer} />
              <TextInput
                style={styles.inputCentral}
                placeholder="Inspecionar outra central (ex.: central_homewise_02)"
                placeholderTextColor={C.textoTer}
                value={buscaCentral}
                onChangeText={setBuscaCentral}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleInspecionarCodigoManual}
              />
              <TouchableOpacity
                style={styles.botaoInspecionar}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={handleInspecionarCodigoManual}
              >
                <Text style={styles.textoBotaoInspecionar}>Verificar</Text>
              </TouchableOpacity>
            </View>

            {carregandoCentrais && centrais.length === 0 ? (
              <View style={styles.blocoVazio}>
                <ActivityIndicator color={C.marca} size="small" />
                <Text style={styles.textoVazio}>Buscando centrais registradas no Firestore...</Text>
              </View>
            ) : centrais.length === 0 ? (
              <View style={styles.blocoVazio}>
                <Text style={styles.textoVazio}>Nenhuma central encontrada no histórico.</Text>
              </View>
            ) : (
              centrais.map((item) => {
                const selecionada = item.dispositivoId === centralSelecionada;
                return (
                  <TouchableOpacity
                    key={item.dispositivoId}
                    style={[styles.cardItemCentral, selecionada && styles.cardItemCentralAtiva]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    onPress={() => setCentralSelecionada(item.dispositivoId)}
                  >
                    <View style={styles.linhaTopoCentral}>
                      <View style={styles.blocoIdCentral}>
                        <Ionicons
                          name="hardware-chip"
                          size={16}
                          color={selecionada ? C.marca : C.textoSec}
                        />
                        <Text style={[styles.nomeCentral, selecionada && { color: C.marca }]}>
                          {item.dispositivoId}
                        </Text>
                      </View>
                      <View style={[styles.badgeSelecionada, selecionada && styles.badgeSelecionadaAtiva]}>
                        <Text
                          style={[
                            styles.textoBadgeSelecionada,
                            selecionada && { color: C.marca }
                          ]}
                        >
                          {selecionada ? 'Em inspeção' : 'Selecionar'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.detalheCentral}>
                      {item.ultimaData
                        ? `Último resumo (${item.ultimaData}): ${item.ultimoConsumoAguaLitros.toFixed(1)} L | ${item.ultimaEnergiaKwh.toFixed(2)} kWh | ${item.diasRegistrados} dias no banco`
                        : 'Sem resumos diários consolidados'}
                    </Text>

                    {item.usuariosVinculados.length > 0 && (
                      <Text style={styles.usuariosCentral}>
                        {`Moradores vinculados (${item.usuariosVinculados.length}): ${item.usuariosVinculados
                          .map((u) => `${u.nome} (${u.email})`)
                          .join(', ')}`}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Diagnóstico Instantâneo da Central Selecionada */}
          <Text style={styles.tituloSecao}>{`DIAGNÓSTICO EM TEMPO REAL — ${centralSelecionada.toUpperCase()}`}</Text>
          <View style={styles.gradeDiagnostico}>
            <View style={styles.cardMetricaDiag}>
              <View style={styles.topoMetricaDiag}>
                <Ionicons name="water-outline" size={16} color={C.agua} />
                <Text style={styles.rotuloMetricaDiag}>Sensor YF-S201</Text>
              </View>
              <Text style={styles.valorMetricaDiag}>
                {leitura ? `${Number(leitura.vazao_l_min || 0).toFixed(2)} L/min` : '--'}
              </Text>
              <Text style={styles.subMetricaDiag}>
                {leitura
                  ? `Acumulado: ${Number(leitura.consumo_agua_litros || 0).toFixed(1)} L`
                  : 'Aguardando pacote'}
              </Text>
            </View>

            <View style={styles.cardMetricaDiag}>
              <View style={styles.topoMetricaDiag}>
                <Ionicons name="flash-outline" size={16} color={C.energia} />
                <Text style={styles.rotuloMetricaDiag}>Sensor PZEM-004T</Text>
              </View>
              <Text style={styles.valorMetricaDiag}>
                {leitura ? `${Number(leitura.potencia_w || 0).toFixed(0)} W` : '--'}
              </Text>
              <Text style={styles.subMetricaDiag}>
                {leitura
                  ? `Energia: ${Number(leitura.energia_kwh || 0).toFixed(3)} kWh`
                  : 'Aguardando pacote'}
              </Text>
            </View>

            <View style={styles.cardMetricaDiag}>
              <View style={styles.topoMetricaDiag}>
                <Ionicons name="pulse-outline" size={16} color={statusTensao.cor} />
                <Text style={styles.rotuloMetricaDiag}>Tensão da Rede</Text>
              </View>
              <Text style={styles.valorMetricaDiag}>
                {tensaoAtual > 0 ? `${tensaoAtual.toFixed(1)} V` : '--'}
              </Text>
              <Text style={[styles.subMetricaDiag, { color: statusTensao.cor }]}>
                {statusTensao.texto}
              </Text>
            </View>

            <View style={styles.cardMetricaDiag}>
              <View style={styles.topoMetricaDiag}>
                <Ionicons name="time-outline" size={16} color={C.marca} />
                <Text style={styles.rotuloMetricaDiag}>Último Pacote</Text>
              </View>
              <Text style={styles.valorMetricaDiagMenor}>
                {leitura?.criado_em ? formatarDataHora(leitura.criado_em) : '--'}
              </Text>
              <Text style={styles.subMetricaDiag}>
                {`${historico.length} leituras carregadas`}
              </Text>
            </View>
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
                  {`Nenhum pacote bruto encontrado para a central "${centralSelecionada}".`}
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
  acoesRestrito: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10
  },
  botaoRestaurarAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alfa(C.marca, 0.14),
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.4)
  },
  textoBotaoRestaurarAdmin: { color: C.marca, fontSize: 13, fontWeight: '700' },
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
  linhaAcoesTopo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14
  },
  botaoSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: alfa(C.marca, 0.12),
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.3)
  },
  textoBotaoSecundario: { color: C.marca, fontSize: 12, fontWeight: '700' },
  botaoSimular: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.superficieAlta,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borda
  },
  textoBotaoSimular: { color: C.textoSec, fontSize: 12, fontWeight: '600' },

  tituloSecao: {
    color: C.textoTer,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4
  },

  cardBuscaCentral: {
    backgroundColor: C.superficie,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borda,
    gap: 10
  },
  linhaInputCentral: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.superficieAlta,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.borda,
    gap: 8
  },
  inputCentral: {
    flex: 1,
    color: C.texto,
    fontSize: 13,
    paddingVertical: 4
  },
  botaoInspecionar: {
    backgroundColor: C.marca,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  textoBotaoInspecionar: { color: '#041017', fontSize: 12, fontWeight: '800' },

  cardItemCentral: {
    backgroundColor: C.superficieAlta,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: C.borda,
    gap: 4
  },
  cardItemCentralAtiva: {
    borderColor: alfa(C.marca, 0.55),
    backgroundColor: alfa(C.marca, 0.08)
  },
  linhaTopoCentral: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  blocoIdCentral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  nomeCentral: { color: C.texto, fontSize: 14, fontWeight: '800' },
  badgeSelecionada: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.superficie,
    borderWidth: 1,
    borderColor: C.borda
  },
  badgeSelecionadaAtiva: {
    backgroundColor: alfa(C.marca, 0.16),
    borderColor: alfa(C.marca, 0.4)
  },
  textoBadgeSelecionada: { color: C.textoTer, fontSize: 11, fontWeight: '700' },
  detalheCentral: { color: C.textoSec, fontSize: 12, lineHeight: 17 },
  usuariosCentral: { color: C.marca, fontSize: 11, fontWeight: '600', marginTop: 2 },

  gradeDiagnostico: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  cardMetricaDiag: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: C.superficie,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borda,
    gap: 4
  },
  topoMetricaDiag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  rotuloMetricaDiag: { color: C.textoSec, fontSize: 11, fontWeight: '700' },
  valorMetricaDiag: { color: C.texto, fontSize: 19, fontWeight: '800', marginTop: 2 },
  valorMetricaDiagMenor: { color: C.texto, fontSize: 14, fontWeight: '800', marginTop: 4 },
  subMetricaDiag: { color: C.textoTer, fontSize: 11 },

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
