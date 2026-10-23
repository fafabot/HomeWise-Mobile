import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { salvarPerfilFirestore } from '@/services/authService';
import { observarHistorico, type Leitura } from '@/services/leiturasService';
import { lerMeta, resumirConsumoMensal } from '@/utils/metas';

type Recurso = 'agua' | 'energia';
const formatar = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function MetasScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId } = useAuth();
  const [recurso, setRecurso] = useState<Recurso>('agua');
  const [dados, setDados] = useState<{ dispositivo: string; leituras: Leitura[] } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [editando, setEditando] = useState<Recurso | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const gravando = useRef(false);

  useEffect(() => observarHistorico(leituras => {
    setDados({ dispositivo: dispositivoId, leituras });
    setFalha(null);
  }, null, dispositivoId, () => setFalha(dispositivoId)), [dispositivoId]);

  const carregando = dados?.dispositivo !== dispositivoId && falha !== dispositivoId;
  const resumo = resumirConsumoMensal(dados?.dispositivo === dispositivoId ? dados.leituras : [], recurso === 'agua' ? 'consumo_agua_litros' : 'energia_kwh');
  const unidade = recurso === 'agua' ? 'L' : 'kWh';
  const cor = recurso === 'agua' ? '#22b7d4' : '#4ade80';
  const metaSalva = perfil?.metas_consumo?.[recurso];
  const meta = typeof metaSalva === 'number' && Number.isFinite(metaSalva) && metaSalva > 0 ? metaSalva : 0;
  const percentual = meta ? resumo.total / meta * 100 : 0;
  const excedeu = meta > 0 && resumo.total > meta;
  const semDados = resumo.diasComLeituras === 0;
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const escala = Math.max(meta, resumo.total, 1);
  const x = (dia: number) => 44 + (dia - 1) / (resumo.diasNoMes - 1) * 266;
  const y = (consumo: number) => 164 - consumo / escala * 132;
  const pontos = resumo.pontos.map(ponto => `${x(ponto.dia)},${y(ponto.valor)}`).join(' ');
  const circunferencia = 2 * Math.PI * 58;

  function abrirEditor() {
    setValor(meta ? String(meta).replace('.', ',') : '');
    setErro('');
    setEditando(recurso);
  }

  async function salvar() {
    if (gravando.current || !editando) return;
    const novaMeta = lerMeta(valor);
    if (novaMeta === null) {
      setErro('Informe um valor maior que zero, sem separador de milhares. Ex.: 9000 ou 250,5.');
      return;
    }
    if (!user) { setErro('Entre na sua conta para salvar a meta.'); return; }
    gravando.current = true;
    setSalvando(true);
    setErro('');
    try {
      const sucesso = await salvarPerfilFirestore(user.uid, { metas_consumo: { [editando]: novaMeta } });
      if (sucesso) setEditando(null);
      else setErro('Não foi possível salvar. Verifique sua conexão e tente novamente.');
    } catch {
      setErro('Não foi possível salvar a meta. Tente novamente.');
    } finally {
      gravando.current = false;
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={s.tela}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar ao perfil" style={s.icone} onPress={() => router.replace('/perfil')}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
          <Text style={s.titulo}>Metas</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir alertas" style={s.icone} onPress={() => router.push('/alertas')}><Ionicons name="notifications-outline" size={20} color="#fff" /></TouchableOpacity>
        </View>
        <Text style={s.eyebrow}>SEU CONSUMO, SOB CONTROLE</Text>
        <Text style={s.chamada}>Pequenas metas.{ '\n'}Grandes economias.</Text>
        <Text style={s.subtitulo}>Acompanhe seus limites mensais de água e energia.</Text>
        <View style={s.abas}>
          {(['agua', 'energia'] as const).map(item => <TouchableOpacity key={item} accessibilityRole="tab" accessibilityState={{ selected: recurso === item }} style={[s.aba, recurso === item && s.abaAtiva]} onPress={() => setRecurso(item)}><Ionicons name={item === 'agua' ? 'water-outline' : 'flash-outline'} size={17} color={recurso === item ? '#fff' : '#64748b'} /><Text style={[s.textoAba, recurso === item && s.textoAtivo]}>{item === 'agua' ? 'Água' : 'Energia'}</Text></TouchableOpacity>)}
        </View>
        <View style={s.card}>
          <View style={s.linha}>
            <View><Text style={s.rotulo}>Meta mensal</Text><Text style={s.meta}>{meta ? `${formatar(meta)} ${unidade}` : 'Defina sua meta'}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Editar meta mensal" onPress={abrirEditor} style={s.editar}><Ionicons name="pencil-outline" size={15} color="#38bdf8" /><Text style={s.link}>{meta ? 'Editar' : 'Definir'}</Text></TouchableOpacity>
          </View>
          <Text style={s.mes}>{mes}</Text>
          {carregando ? <ActivityIndicator size="large" color={cor} style={s.carregando} /> : falha === dispositivoId ? <Text accessibilityRole="alert" style={s.erro}>Não foi possível carregar o consumo. Verifique sua conexão.</Text> : <>
            <View style={s.anel} accessibilityLabel={meta ? `${Math.round(percentual)}% da meta consumidos` : 'Meta não definida'}>
              <Svg width={152} height={152} viewBox="0 0 152 152">
                <Circle cx={76} cy={76} r={58} fill="none" stroke="#183442" strokeWidth={10} />
                {meta > 0 && percentual > 0 && <Circle cx={76} cy={76} r={58} fill="none" stroke={excedeu ? '#f87171' : cor} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${circunferencia} ${circunferencia}`} strokeDashoffset={circunferencia * (1 - Math.min(percentual, 100) / 100)} rotation={-90} origin="76, 76" />}
              </Svg>
              <View style={s.centroAnel}><Text style={[s.percentual, excedeu && s.erro]}>{meta ? `${Math.round(percentual)}%` : '—'}</Text><Text style={s.legenda}>{meta ? 'da meta' : 'sem meta'}</Text></View>
            </View>
            <Text style={s.consumo}>{formatar(resumo.total)} {unidade} consumidos</Text>
            <Text style={[s.restante, excedeu && s.erro]}>{!meta ? 'Defina um limite para acompanhar sua economia.' : excedeu ? `Você ultrapassou a meta em ${formatar(resumo.total - meta)} ${unidade}.` : `Restam ${formatar(meta - resumo.total)} ${unidade} até o limite da sua meta.`}</Text>
            {semDados && <Text style={s.aviso}>Ainda não há leituras neste mês.</Text>}
          </>}
        </View>
        <View style={s.card}>
          <Text style={s.titulo}>Evolução no mês ({unidade})</Text>
          <Text style={s.mes}>Consumo acumulado e limite mensal</Text>
          {!carregando && falha !== dispositivoId && !semDados ? <>
            <Svg width="100%" height={210} viewBox="0 0 330 210" accessibilityLabel="Gráfico do consumo acumulado no mês">
              {[0, 0.5, 1].map(fracao => <ViewSvg key={fracao} valor={escala * fracao} y={y(escala * fracao)} />)}
              {meta > 0 && <Line x1={44} x2={310} y1={y(meta)} y2={y(meta)} stroke="#7c92b4" strokeWidth={2} strokeDasharray="6 5" />}
              <Polyline points={`44,164 ${pontos}`} fill="none" stroke={cor} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {resumo.pontos.filter(p => p.medido).map(ponto => <Circle key={ponto.dia} cx={x(ponto.dia)} cy={y(ponto.valor)} r={3} fill={cor} />)}
              {[1, 8, 15, 22, resumo.diasNoMes].map(dia => <SvgText key={dia} x={x(dia)} y={190} fill="#94a3b8" fontSize={11} textAnchor="middle">{dia}</SvgText>)}
            </Svg>
            <View style={s.legendas}><View style={s.itemLegenda}><View style={[s.traco, { backgroundColor: cor }]} /><Text style={s.legenda}>Consumo</Text></View><View style={s.itemLegenda}><View style={[s.traco, { backgroundColor: '#7c92b4' }]} /><Text style={s.legenda}>Meta mensal</Text></View></View>
          </> : <View style={s.vazio}><Ionicons name="stats-chart-outline" size={32} color="#3d6575" /><Text style={s.restante}>{carregando ? 'Carregando seu histórico...' : falha === dispositivoId ? 'Histórico indisponível no momento.' : 'Sua evolução aparecerá quando chegarem as primeiras leituras.'}</Text></View>}
          <Text style={s.nota}>Calculado a partir do maior consumo diário registrado. Dias sem leituras não acrescentam consumo.</Text>
        </View>
      </ScrollView>
      <Modal visible={editando !== null} transparent animationType="fade" onRequestClose={() => { if (!gravando.current) setEditando(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.fundoModal}>
          <ScrollView contentContainerStyle={s.scrollModal} keyboardShouldPersistTaps="handled">
            <View style={s.modal} accessibilityViewIsModal>
              <Text accessibilityRole="header" style={s.titulo}>Meta mensal de {editando === 'agua' ? 'água' : 'energia'}</Text>
              <Text style={s.subtitulo}>Quanto você quer consumir no máximo por mês?</Text>
              <Text style={s.rotulo}>Limite em {editando === 'agua' ? 'litros (L)' : 'kWh'}</Text>
              <TextInput accessibilityLabel="Valor da meta mensal" style={s.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder={editando === 'agua' ? 'Ex.: 9000' : 'Ex.: 250'} placeholderTextColor="#64748b" editable={!salvando} maxLength={20} />
              {!!erro && <Text accessibilityRole="alert" style={s.erro}>{erro}</Text>}
              <TouchableOpacity accessibilityRole="button" disabled={salvando} style={[s.salvar, salvando && { opacity: 0.6 }]} onPress={() => void salvar()}>{salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.textoAtivo}>Salvar meta</Text>}</TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={salvando} style={s.cancelar} onPress={() => setEditando(null)}><Text style={s.legenda}>Cancelar</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ViewSvg({ valor, y }: { valor: number; y: number }) {
  return <><Line x1={44} x2={310} y1={y} y2={y} stroke="#183442" strokeWidth={1} /><SvgText x={36} y={y + 4} fill="#94a3b8" fontSize={10} textAnchor="end">{valor >= 1000 ? `${formatar(valor / 1000)}k` : formatar(valor)}</SvgText></>;
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#07131b' },
  conteudo: { padding: 20, paddingTop: 12, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  icone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0c202d', borderWidth: 1, borderColor: '#1e3a4f', alignItems: 'center', justifyContent: 'center' },
  titulo: { color: '#fff', fontSize: 17, fontWeight: '700' },
  eyebrow: { color: '#76d7cd', fontSize: 10, letterSpacing: 1.8, fontWeight: '700' },
  chamada: { color: '#edf4ff', fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: -4 },
  subtitulo: { color: '#94a3b8', fontSize: 14, lineHeight: 21 },
  abas: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: '#0a1a24' },
  aba: { flex: 1, flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  abaAtiva: { backgroundColor: '#0284c7' },
  textoAba: { color: '#64748b', fontWeight: '600' },
  textoAtivo: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#0b1d28', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e3a4b' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rotulo: { color: '#94a3b8', fontSize: 13, marginBottom: 5 },
  meta: { color: '#fff', fontSize: 21, fontWeight: '700' },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  link: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },
  mes: { color: '#64748b', fontSize: 12, marginTop: 8 },
  anel: { width: 152, height: 152, alignSelf: 'center', marginTop: 20, marginBottom: 12 },
  centroAnel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percentual: { color: '#fff', fontSize: 30, fontWeight: '800' },
  legenda: { color: '#94a3b8', fontSize: 12 },
  consumo: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  restante: { color: '#94a3b8', textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 8 },
  aviso: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 12 },
  erro: { color: '#f87171', fontSize: 13, lineHeight: 20 },
  carregando: { marginVertical: 56 },
  legendas: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  traco: { width: 20, height: 3, borderRadius: 2 },
  vazio: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  nota: { color: '#64748b', fontSize: 11, lineHeight: 17, marginTop: 20 },
  fundoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  scrollModal: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#0b1d28', borderRadius: 20, borderWidth: 1, borderColor: '#1e3a4b', padding: 24, gap: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
  input: { backgroundColor: '#07131b', borderColor: '#1e3a4f', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 20, color: '#fff' },
  salvar: { backgroundColor: '#0284c7', borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelar: { padding: 10, alignItems: 'center' },
});