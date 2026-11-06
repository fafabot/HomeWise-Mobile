import { showAlert } from '@/utils/alert';
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { atualizarPerfilUsuario } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePhoto from '@/components/ProfilePhoto';
import { C, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

export default function EditarPerfilScreen() {
  const router = useRouter();
  const { user: usuario, perfil } = useAuth();

  const [nome, setNome] = useState(perfil?.nome || usuario?.displayName || '');
  const [email] = useState(usuario?.email || '');
  const [dispositivoId, setDispositivoId] = useState(perfil?.dispositivo_id || '');
  const [telefone, setTelefone] = useState(perfil?.telefone || '');
  const [residencia, setResidencia] = useState(perfil?.residencia || '');
  const [cep, setCep] = useState(formatarCep(perfil?.cep || ''));
  const [cidade, setCidade] = useState(perfil?.cidade || '');
  const [estado, setEstado] = useState(perfil?.estado || '');
  const [consultandoCep, setConsultandoCep] = useState(false);
  const [mensagemCep, setMensagemCep] = useState('');
  const [erroCep, setErroCep] = useState(false);
  const [cepParaConsultar, setCepParaConsultar] = useState<{ valor: string } | null>(null);
  const [seletorEstadoVisivel, setSeletorEstadoVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const consultaCepAtual = useRef(0);

  useEffect(() => {
    if (!cepParaConsultar) return;

    const cepNumerico = cepParaConsultar.valor.replace(/\D/g, '');
    if (cepNumerico.length !== 8) return;

    const consultaId = ++consultaCepAtual.current;
    const temporizador = setTimeout(async () => {
      setConsultandoCep(true);
      setErroCep(false);
      setMensagemCep('Consultando CEP...');

      try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cepNumerico}/json/`);
        if (!resposta.ok) throw new Error(`Consulta de CEP retornou HTTP ${resposta.status}`);

        const dados: {
          logradouro?: string;
          localidade?: string;
          uf?: string;
          erro?: boolean;
        } = await resposta.json();
        if (consultaId !== consultaCepAtual.current) return;
        if (dados.erro) {
          setErroCep(true);
          setMensagemCep('CEP não encontrado. Verifique os números.');
          return;
        }

        if (dados.logradouro?.trim()) setResidencia(dados.logradouro.trim());
        if (dados.localidade?.trim()) setCidade(dados.localidade.trim());
        if (dados.uf?.trim()) setEstado(dados.uf.trim());
        setMensagemCep(
          dados.logradouro?.trim()
            ? 'Rua, cidade e estado preenchidos pelo CEP.'
            : 'CEP encontrado; preencha a rua manualmente.'
        );
      } catch (error) {
        if (consultaId !== consultaCepAtual.current) return;
        console.warn('[ViaCEP] Erro ao consultar CEP:', error);
        setErroCep(true);
        setMensagemCep('Não foi possível consultar o CEP. Verifique a conexão e tente novamente.');
      } finally {
        if (consultaId === consultaCepAtual.current) setConsultandoCep(false);
      }
    }, 400);

    return () => {
      clearTimeout(temporizador);
      if (consultaCepAtual.current === consultaId) consultaCepAtual.current += 1;
    };
  }, [cepParaConsultar]);

  // O perfil chega de forma assíncrona (onSnapshot no AuthContext). Quando algum valor salvo muda,
  // os campos são sincronizados durante a renderização, sem setState dentro de useEffect.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const { nome: nomeSalvo, dispositivo_id: centralSalva, telefone: telefoneSalvo, residencia: residenciaSalva, cep: cepSalvo, cidade: cidadeSalva, estado: estadoSalvo } = perfil ?? {};
  const [perfilSincronizado, setPerfilSincronizado] = useState({ nomeSalvo, centralSalva, telefoneSalvo, residenciaSalva, cepSalvo, cidadeSalva, estadoSalvo });
  if (
    perfilSincronizado.nomeSalvo !== nomeSalvo ||
    perfilSincronizado.centralSalva !== centralSalva ||
    perfilSincronizado.telefoneSalvo !== telefoneSalvo ||
    perfilSincronizado.residenciaSalva !== residenciaSalva ||
    perfilSincronizado.cepSalvo !== cepSalvo ||
    perfilSincronizado.cidadeSalva !== cidadeSalva ||
    perfilSincronizado.estadoSalvo !== estadoSalvo
  ) {
    setPerfilSincronizado({ nomeSalvo, centralSalva, telefoneSalvo, residenciaSalva, cepSalvo, cidadeSalva, estadoSalvo });
    if (nomeSalvo) setNome(nomeSalvo);
    if (centralSalva !== undefined) setDispositivoId(centralSalva);
    if (telefoneSalvo) setTelefone(telefoneSalvo);
    if (residenciaSalva) setResidencia(residenciaSalva);
    if (cepSalvo) setCep(formatarCep(cepSalvo));
    if (cidadeSalva !== undefined) setCidade(cidadeSalva);
    if (estadoSalvo !== undefined) setEstado(estadoSalvo);
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      showAlert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }

    setSalvando(true);
    const resultado = await atualizarPerfilUsuario(nome, {
      dispositivo_id: dispositivoId.trim(),
      telefone: telefone.trim(),
      residencia: residencia.trim(),
      cep: cep.trim(),
      cidade: cidade.trim(),
      estado: estado.trim()
    });
    setSalvando(false);

    if (resultado.sucesso) {
      showAlert('Sucesso', 'Perfil atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.push('/perfil') }
      ]);
    } else {
      showAlert('Erro', resultado.erro || 'Não foi possível salvar as alterações.');
    }
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.conteudo}>

          <CabecalhoTela titulo="Editar Perfil" onVoltar={() => router.push('/perfil')} />

          {/* Foto de Perfil */}
          <View style={styles.avatarContainer}>
            <ProfilePhoto nome={nome} size={92} disabled={salvando} />
            <Text style={styles.nomeHeader}>{nome || 'Morador'}</Text>
          </View>

          {/* Dados pessoais */}
          <Text style={styles.tituloGrupo}>DADOS PESSOAIS</Text>
          <View style={styles.formCard}>
            <Campo rotulo="Nome Completo" icone="person-outline">
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Seu nome"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="Nome Completo"
                />
              )}
            </Campo>

            <Campo rotulo="E-mail da Conta" icone="mail-outline" bloqueado>
              {(foco) => (
                <TextInput
                  {...foco}
                  style={[styles.input, { color: C.textoSec }]}
                  value={email}
                  editable={false}
                  accessibilityLabel="E-mail da Conta, não editável"
                />
              )}
            </Campo>

            <Campo rotulo="Telefone" icone="call-outline">
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={telefone}
                  onChangeText={setTelefone}
                  keyboardType="phone-pad"
                  placeholder="(11) 99999-9999"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="Telefone"
                />
              )}
            </Campo>
          </View>

          {/* Residência e central */}
          <Text style={styles.tituloGrupo}>RESIDÊNCIA E CENTRAL</Text>
          <View style={styles.formCard}>
            <View style={styles.cabecalhoCentral}>
              <Text style={styles.label}>Código da Central HomeWise (Opcional)</Text>
              <TouchableOpacity
                style={styles.botaoScanPequeno}
                activeOpacity={0.7}
                accessibilityRole="button"
                onPress={() => router.push('/escanear-qrcode' as any)}
              >
                <Ionicons name="qr-code-outline" size={13} color={C.marca} style={{ marginRight: 4 }} />
                <Text style={styles.textoScanPequeno}>Escanear QR Code</Text>
              </TouchableOpacity>
            </View>
            <Campo icone="hardware-chip-outline" acaoDireita={
              <TouchableOpacity
                onPress={() => router.push('/escanear-qrcode' as any)}
                activeOpacity={0.7}
                style={styles.botaoCamera}
                accessibilityRole="button"
                accessibilityLabel="Escanear QR Code da central"
              >
                <Ionicons name="camera-outline" size={20} color={C.marca} />
              </TouchableOpacity>
            }>
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={dispositivoId}
                  onChangeText={setDispositivoId}
                  placeholder="Ex.: central_homewise_01"
                  placeholderTextColor={C.textoTer}
                  autoCapitalize="none"
                  accessibilityLabel="Código da Central HomeWise, opcional"
                />
              )}
            </Campo>
            <Text style={styles.helperText}>
              Este código vincula os sensores de água e energia da sua casa à sua conta. Deixe em branco se quiser desvincular a central atual.
            </Text>

            <Campo
              rotulo="CEP"
              icone="location-outline"
              acaoDireita={consultandoCep ? <ActivityIndicator size="small" color={C.marca} /> : undefined}
            >
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={cep}
                  onChangeText={(valor) => {
                    const cepFormatado = formatarCep(valor);
                    setCep(cepFormatado);
                    const cepNumerico = cepFormatado.replace(/\D/g, '');
                    setCepParaConsultar(
                      cepNumerico.length === 8
                        ? { valor: cepFormatado }
                        : null
                    );
                    setConsultandoCep(false);
                    setMensagemCep('');
                    setErroCep(false);
                  }}
                  keyboardType="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="CEP"
                />
              )}
            </Campo>
            <Text
              style={[styles.helperText, erroCep && styles.cepErro]}
              accessibilityLiveRegion="polite"
            >
              {mensagemCep || 'Sem o CEP? Selecione o estado abaixo e informe a cidade e a rua.'}
            </Text>

            <Campo rotulo="Rua e número" icone="home-outline">
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={residencia}
                  onChangeText={setResidencia}
                  placeholder="Rua e número"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="Rua e número da residência"
                />
              )}
            </Campo>

            <Campo rotulo="Cidade" icone="business-outline">
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={cidade}
                  onChangeText={setCidade}
                  placeholder="Cidade"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="Cidade"
                />
              )}
            </Campo>

            <Campo rotulo="UF" icone="map-outline">
              {() => (
                <TouchableOpacity
                  style={styles.seletorEstado}
                  activeOpacity={0.75}
                  onPress={() => setSeletorEstadoVisivel(true)}
                  accessibilityRole="button"
                  accessibilityLabel={estado ? `UF: ${nomeEstado(estado)}` : 'Selecionar UF'}
                  accessibilityHint="Abre a lista de UFs do Brasil"
                  accessibilityState={{ expanded: seletorEstadoVisivel }}
                >
                  <Text style={[styles.textoSeletorEstado, !estado && styles.placeholderSeletorEstado]}>
                    {estado ? nomeEstado(estado) : 'Selecione uma UF'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={C.textoSec} />
                </TouchableOpacity>
              )}
            </Campo>
          </View>

          {/* Botão Salvar */}
          <TouchableOpacity
            style={[styles.botaoSalvar, salvando && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSalvar}
            disabled={salvando}
            accessibilityRole="button"
            accessibilityState={{ disabled: salvando, busy: salvando }}
          >
            {salvando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.botaoSalvarTexto}>Salvar Alterações</Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
      <Modal
        visible={seletorEstadoVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setSeletorEstadoVisivel(false)}
      >
        <View style={styles.fundoModalEstado}>
          <View style={styles.modalEstado} accessibilityViewIsModal>
            <View style={styles.cabecalhoModalEstado}>
              <Text accessibilityRole="header" style={styles.tituloModalEstado}>Selecione a UF</Text>
              <TouchableOpacity
                onPress={() => setSeletorEstadoVisivel(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar lista de estados"
                style={styles.fecharModalEstado}
              >
                <Ionicons name="close" size={22} color={C.textoSec} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ESTADOS_BRASIL.map((opcao) => (
                <TouchableOpacity
                  key={opcao.uf}
                  style={styles.opcaoEstado}
                  activeOpacity={0.7}
                  onPress={() => {
                    setEstado(opcao.uf);
                    setSeletorEstadoVisivel(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: estado === opcao.uf }}
                >
                  <Text style={styles.textoOpcaoEstado}>{opcao.nome}</Text>
                  <Text style={styles.siglaEstado}>{opcao.uf}</Text>
                  {estado === opcao.uf && <Ionicons name="checkmark" size={18} color={C.marca} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const ESTADOS_BRASIL = [
  { nome: 'Acre', uf: 'AC' },
  { nome: 'Alagoas', uf: 'AL' },
  { nome: 'Amapá', uf: 'AP' },
  { nome: 'Amazonas', uf: 'AM' },
  { nome: 'Bahia', uf: 'BA' },
  { nome: 'Ceará', uf: 'CE' },
  { nome: 'Distrito Federal', uf: 'DF' },
  { nome: 'Espírito Santo', uf: 'ES' },
  { nome: 'Goiás', uf: 'GO' },
  { nome: 'Maranhão', uf: 'MA' },
  { nome: 'Mato Grosso', uf: 'MT' },
  { nome: 'Mato Grosso do Sul', uf: 'MS' },
  { nome: 'Minas Gerais', uf: 'MG' },
  { nome: 'Pará', uf: 'PA' },
  { nome: 'Paraíba', uf: 'PB' },
  { nome: 'Paraná', uf: 'PR' },
  { nome: 'Pernambuco', uf: 'PE' },
  { nome: 'Piauí', uf: 'PI' },
  { nome: 'Rio de Janeiro', uf: 'RJ' },
  { nome: 'Rio Grande do Norte', uf: 'RN' },
  { nome: 'Rio Grande do Sul', uf: 'RS' },
  { nome: 'Rondônia', uf: 'RO' },
  { nome: 'Roraima', uf: 'RR' },
  { nome: 'Santa Catarina', uf: 'SC' },
  { nome: 'São Paulo', uf: 'SP' },
  { nome: 'Sergipe', uf: 'SE' },
  { nome: 'Tocantins', uf: 'TO' }
] as const;

function nomeEstado(uf: string) {
  return ESTADOS_BRASIL.find((opcao) => opcao.uf === uf.toUpperCase())?.nome ?? uf;
}

function formatarCep(valor: string) {
  const numeros = valor.replace(/\D/g, '').slice(0, 8);
  return numeros.length > 5 ? `${numeros.slice(0, 5)}-${numeros.slice(5)}` : numeros;
}

type PropsFoco = { onFocus: () => void; onBlur: () => void };

/** Campo do formulário com rótulo, ícone e destaque visual enquanto está em foco. */
function Campo({ rotulo, icone, bloqueado, acaoDireita, children }: {
  rotulo?: string;
  icone: keyof typeof Ionicons.glyphMap;
  bloqueado?: boolean;
  acaoDireita?: React.ReactNode;
  children: (foco: PropsFoco) => React.ReactNode;
}) {
  const [emFoco, setEmFoco] = useState(false);
  return (
    <View style={styles.inputGrupo}>
      {!!rotulo && <Text style={styles.label}>{rotulo}</Text>}
      <View style={[styles.inputContainer, bloqueado && styles.inputBloqueado, emFoco && styles.inputFoco]}>
        <Ionicons name={icone} size={17} color={emFoco ? C.marca : C.textoTer} />
        {children({ onFocus: () => setEmFoco(true), onBlur: () => setEmFoco(false) })}
        {bloqueado ? <Ionicons name="lock-closed" size={15} color={C.textoTer} /> : acaoDireita}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fundo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  conteudo: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: 8 },
  nomeHeader: { fontSize: 20, fontWeight: '800', color: C.texto, marginTop: 4, letterSpacing: -0.3 },
  tituloGrupo: { color: C.textoTer, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, marginTop: 20, marginBottom: 10, marginLeft: 4 },
  formCard: {
    backgroundColor: C.superficie,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borda,
    gap: 16
  },
  inputGrupo: { gap: 7 },
  label: { fontSize: 13, fontWeight: '600', color: C.textoSec, flexShrink: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.fundo,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borda,
    paddingHorizontal: 14
  },
  inputFoco: { borderColor: C.marca, backgroundColor: C.fundoProfundo },
  inputBloqueado: { backgroundColor: C.superficieAlta, borderColor: C.bordaSuave },
  input: { flex: 1, height: 50, color: C.texto, fontSize: 15 },
  helperText: { fontSize: 11.5, lineHeight: 16, color: C.textoTer, marginTop: -8 },
  cepErro: { color: C.perigo },
  seletorEstado: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textoSeletorEstado: { color: C.texto, fontSize: 15 },
  placeholderSeletorEstado: { color: C.textoTer },
  fundoModalEstado: { flex: 1, backgroundColor: 'rgba(2, 8, 12, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalEstado: { width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: C.superficie, borderRadius: 22, borderWidth: 1, borderColor: C.bordaForte, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  cabecalhoModalEstado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.borda },
  tituloModalEstado: { color: C.texto, fontSize: 17, fontWeight: '700' },
  fecharModalEstado: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  opcaoEstado: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.bordaSuave },
  textoOpcaoEstado: { flex: 1, color: C.texto, fontSize: 15 },
  siglaEstado: { color: C.textoSec, fontSize: 13, fontWeight: '600', minWidth: 26, textAlign: 'right' },
  cabecalhoCentral: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: -9 },
  botaoCamera: { padding: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  botaoSalvar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.marcaForte,
    minHeight: 54,
    borderRadius: 16,
    marginTop: 24
  },
  botaoSalvarTexto: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  botaoScanPequeno: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alfa(C.marca, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.3)
  },
  textoScanPequeno: { color: C.marca, fontSize: 11.5, fontWeight: '700' }
});
