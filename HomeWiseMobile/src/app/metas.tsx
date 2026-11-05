import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { temAcessoPlus } from '@/constants/planos';
import { salvarPerfilFirestore } from '@/services/authService';
import { mensagemErroLeituras, useHistoricoCentral } from '@/hooks/use-leituras-central';
import AvisoFalhaLeituras, { SeloDesatualizado } from '@/components/AvisoFalhaLeituras';
import { lerMeta, resumirConsumoMensal } from '@/utils/metas';
import { C, LARGURA_MAXIMA, NUMEROS, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';
import BotaoDestaque from '@/components/hw/BotaoDestaque';

// Linha da meta no gráfico e na legenda (limite = âmbar)
const COR_META = C.alerta;

type Recurso = 'agua' | 'energia';
const formatar = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function MetasScreen() {
  const router = useRouter();
  const { user, perfil, dispositivoId } = useAuth();
  const [recurso, setRecurso] = useState<Recurso>('agua');
  // Estados por sessão (usuário + central): ao voltar para uma central anterior, erros antigos não reaparecem
  const historicoCentral = useHistoricoCentral(user?.uid, dispositivoId);
  const { bruto } = historicoCentral;
  const [editando, setEditando] = useState<Recurso | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const gravando = useRef(false);

  const carregando = bruto.estado === 'carregando';
  // Erro sem dados recebidos nesta sessão: consumo indisponível. Erro com dados: exibidos como desatualizados.
  const indisponivel = bruto.estado === 'erro' && !bruto.recebido;
  const resumo = resumirConsumoMensal(bruto.dados ?? [], recurso === 'agua' ? 'consumo_agua_litros' : 'energia_kwh');
  const unidade = recurso === 'agua' ? 'L' : 'kWh';
  const cor = recurso === 'agua' ? C.agua : C.energia;
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
  const possuiPlus = temAcessoPlus(perfil?.plano, perfil?.status_assinatura);

  function abrirEditor() {
    if (!possuiPlus) {
      router.push('/gerenciar-assinatura');
      return;
    }
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
          <CabecalhoTela
            titulo="Metas"
            onVoltar={() => router.replace('/perfil')}
            rotuloVoltar="Voltar ao perfil"
            acao={{ icone: 'notifications-outline', rotulo: 'Abrir alertas', onPress: () => router.push('/alertas') }}
          />
        </View>
        <View style={s.intro}>
          <Text style={s.eyebrow}>SEU CONSUMO, SOB CONTROLE</Text>
          <Text style={s.chamada}>Pequenas metas.{ '\n'}Grandes economias.</Text>
          <Text style={s.subtitulo}>Acompanhe seus limites mensais de água e energia.</Text>
        </View>
        <AvisoFalhaLeituras fontes={historicoCentral.fontes} onTentarNovamente={historicoCentral.tentarNovamente} />
        {!possuiPlus && (
          <View style={s.cardUpgrade}>
            <View style={s.upgradeTopo}>
              <Ionicons name="lock-closed" size={16} color={C.marca} />
              <Text style={s.upgradeBadge}>EXCLUSIVO PLANO PLUS E PREMIUM</Text>
            </View>
            <Text style={s.upgradeTitulo}>Desbloqueie Metas de Economia</Text>
            <Text style={s.upgradeTexto}>
              Defina limites personalizados de água e energia e acompanhe alertas de meta atingida assinando o plano HomeWise Plus.
            </Text>
            <BotaoDestaque rotulo="Fazer upgrade para Plus" style={{ marginTop: 6 }} onPress={() => router.push('/gerenciar-assinatura')} />
          </View>
        )}
        <View style={s.abas}>
          {(['agua', 'energia'] as const).map(item => <TouchableOpacity key={item} accessibilityRole="tab" accessibilityState={{ selected: recurso === item }} style={[s.aba, recurso === item && { backgroundColor: alfa(cor, 0.16), borderColor: alfa(cor, 0.5) }]} onPress={() => setRecurso(item)}><Ionicons name={item === 'agua' ? 'water-outline' : 'flash-outline'} size={17} color={recurso === item ? cor : C.textoTer} /><Text style={[s.textoAba, recurso === item && s.textoAtivo]}>{item === 'agua' ? 'Água' : 'Energia'}</Text></TouchableOpacity>)}
        </View>
        <View style={s.card}>
          <View style={s.linha}>
            <View><Text style={s.rotulo}>Meta mensal</Text><Text style={s.meta}>{meta ? `${formatar(meta)} ${unidade}` : 'Defina sua meta'}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Editar meta mensal" onPress={abrirEditor} style={s.editar}><Ionicons name={possuiPlus ? 'pencil-outline' : 'lock-closed-outline'} size={15} color={C.marca} /><Text style={s.link}>{!possuiPlus ? 'Requer Plus' : meta ? 'Editar' : 'Definir'}</Text></TouchableOpacity>
          </View>
          <Text style={s.mes}>{mes}</Text>
          {carregando ? <ActivityIndicator size="large" color={cor} style={s.carregando} /> : indisponivel ? <Text accessibilityRole="alert" style={s.erro}>{mensagemErroLeituras(bruto.erro)}</Text> : <>
            <View style={s.anel} accessibilityLabel={meta ? `${Math.round(percentual)}% da meta consumidos` : 'Meta não definida'}>
              <Svg width={152} height={152} viewBox="0 0 152 152">
                <Circle cx={76} cy={76} r={58} fill="none" stroke={C.superficieAlta} strokeWidth={12} />
                {meta > 0 && percentual > 0 && <Circle cx={76} cy={76} r={58} fill="none" stroke={excedeu ? C.perigo : cor} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${circunferencia} ${circunferencia}`} strokeDashoffset={circunferencia * (1 - Math.min(percentual, 100) / 100)} rotation={-90} origin="76, 76" />}
              </Svg>
              <View style={s.centroAnel}><Text style={[s.percentual, excedeu && s.erro]}>{meta ? `${Math.round(percentual)}%` : '—'}</Text><Text style={s.legenda}>{meta ? 'da meta' : 'sem meta'}</Text></View>
            </View>
            <Text style={s.consumo}>{formatar(resumo.total)} {unidade} consumidos</Text>
            <Text style={[s.restante, excedeu && s.erro]}>{!meta ? 'Defina um limite para acompanhar sua economia.' : excedeu ? `Você ultrapassou a meta em ${formatar(resumo.total - meta)} ${unidade}.` : `Restam ${formatar(meta - resumo.total)} ${unidade} até o limite da sua meta.`}</Text>
            {semDados && <Text style={s.aviso}>Ainda não há leituras neste mês.</Text>}
            <SeloDesatualizado visivel={bruto.desatualizado} />
          </>}
        </View>
        <View style={s.card}>
          <Text style={s.titulo}>Evolução no mês ({unidade})</Text>
          <Text style={s.mes}>Consumo acumulado e limite mensal</Text>
          {!carregando && !indisponivel && !semDados ? <>
            <Svg width="100%" height={210} viewBox="0 0 330 210" accessibilityLabel="Gráfico do consumo acumulado no mês">
              {[0, 0.5, 1].map(fracao => <ViewSvg key={fracao} valor={escala * fracao} y={y(escala * fracao)} />)}
              {meta > 0 && <Line x1={44} x2={310} y1={y(meta)} y2={y(meta)} stroke={COR_META} strokeWidth={2} strokeDasharray="6 5" />}
              <Polyline points={`44,164 ${pontos}`} fill="none" stroke={cor} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {resumo.pontos.filter(p => p.medido).map(ponto => <Circle key={ponto.dia} cx={x(ponto.dia)} cy={y(ponto.valor)} r={3} fill={cor} />)}
              {[1, 8, 15, 22, resumo.diasNoMes].map(dia => <SvgText key={dia} x={x(dia)} y={190} fill={C.textoTer} fontSize={11} textAnchor="middle">{dia}</SvgText>)}
            </Svg>
            <View style={s.legendas}><View style={s.itemLegenda}><View style={[s.traco, { backgroundColor: cor }]} /><Text style={s.legenda}>Consumo</Text></View><View style={s.itemLegenda}><View style={[s.traco, { backgroundColor: COR_META }]} /><Text style={s.legenda}>Meta mensal</Text></View></View>
          </> : <View style={s.vazio}><Ionicons name="stats-chart-outline" size={32} color={C.bordaForte} /><Text style={s.restante}>{carregando ? 'Carregando seu histórico...' : indisponivel ? 'Histórico indisponível no momento.' : 'Sua evolução aparecerá quando chegarem as primeiras leituras.'}</Text></View>}
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
              <TextInput accessibilityLabel="Valor da meta mensal" style={s.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder={editando === 'agua' ? 'Ex.: 9000' : 'Ex.: 250'} placeholderTextColor={C.textoTer} editable={!salvando} maxLength={20} returnKeyType="done" onSubmitEditing={() => void salvar()} />
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
  return <><Line x1={44} x2={310} y1={y} y2={y} stroke={C.bordaSuave} strokeWidth={1} /><SvgText x={36} y={y + 4} fill={C.textoTer} fontSize={10} textAnchor="end">{valor >= 1000 ? `${formatar(valor / 1000)}k` : formatar(valor)}</SvgText></>;
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: C.fundo },
  conteudo: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 16, width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' },
  header: { marginBottom: -20 },
  titulo: { color: C.texto, fontSize: 16, fontWeight: '700' },
  intro: { gap: 8, paddingVertical: 4 },
  eyebrow: { color: C.marca, fontSize: 10.5, letterSpacing: 1.8, fontWeight: '800' },
  chamada: { color: C.texto, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  subtitulo: { color: C.textoSec, fontSize: 14, lineHeight: 21 },
  abas: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: C.superficie, borderWidth: 1, borderColor: C.bordaSuave },
  aba: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  textoAba: { color: C.textoTer, fontWeight: '700' },
  textoAtivo: { color: C.texto, fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: C.superficie, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.borda },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rotulo: { color: C.textoSec, fontSize: 13, marginBottom: 5 },
  meta: { color: C.texto, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, ...NUMEROS },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: alfa(C.marca, 0.1), borderWidth: 1, borderColor: alfa(C.marca, 0.3) },
  link: { color: C.marca, fontSize: 13, fontWeight: '700' },
  mes: { color: C.textoTer, fontSize: 12, marginTop: 8, textTransform: 'capitalize' },
  anel: { width: 152, height: 152, alignSelf: 'center', marginTop: 20, marginBottom: 14 },
  centroAnel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percentual: { color: C.texto, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, ...NUMEROS },
  legenda: { color: C.textoSec, fontSize: 12 },
  consumo: { color: C.texto, fontSize: 18, fontWeight: '700', textAlign: 'center', ...NUMEROS },
  restante: { color: C.textoSec, textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 8 },
  aviso: { color: C.textoTer, fontSize: 12, textAlign: 'center', marginTop: 12 },
  erro: { color: C.perigo, fontSize: 13, lineHeight: 20 },
  carregando: { marginVertical: 56 },
  legendas: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  traco: { width: 20, height: 3, borderRadius: 2 },
  vazio: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  nota: { color: C.textoTer, fontSize: 11.5, lineHeight: 17, marginTop: 20 },
  fundoModal: { flex: 1, backgroundColor: 'rgba(2, 8, 12, 0.8)' },
  scrollModal: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: C.superficie, borderRadius: 24, borderWidth: 1, borderColor: C.bordaForte, padding: 24, gap: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
  input: { backgroundColor: C.fundo, borderColor: C.bordaForte, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 20, color: C.texto, ...NUMEROS },
  salvar: { backgroundColor: C.marcaForte, borderRadius: 14, minHeight: 52, padding: 16, alignItems: 'center', justifyContent: 'center' },
  cancelar: { padding: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cardUpgrade: { backgroundColor: C.superficieAlta, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.borda, gap: 8 },
  upgradeTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  upgradeBadge: { color: C.marca, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  upgradeTitulo: { color: C.texto, fontSize: 17, fontWeight: '700' },
  upgradeTexto: { color: C.textoSec, fontSize: 13, lineHeight: 19 },
});
