import { showAlert } from '@/utils/alert';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator
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
  const [cep, setCep] = useState(perfil?.cep || '');
  const [salvando, setSalvando] = useState(false);

  // O perfil chega de forma assíncrona (onSnapshot no AuthContext). Quando algum valor salvo muda,
  // os campos são sincronizados durante a renderização, sem setState dentro de useEffect.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const { nome: nomeSalvo, dispositivo_id: centralSalva, telefone: telefoneSalvo, residencia: residenciaSalva, cep: cepSalvo } = perfil ?? {};
  const [perfilSincronizado, setPerfilSincronizado] = useState({ nomeSalvo, centralSalva, telefoneSalvo, residenciaSalva, cepSalvo });
  if (
    perfilSincronizado.nomeSalvo !== nomeSalvo ||
    perfilSincronizado.centralSalva !== centralSalva ||
    perfilSincronizado.telefoneSalvo !== telefoneSalvo ||
    perfilSincronizado.residenciaSalva !== residenciaSalva ||
    perfilSincronizado.cepSalvo !== cepSalvo
  ) {
    setPerfilSincronizado({ nomeSalvo, centralSalva, telefoneSalvo, residenciaSalva, cepSalvo });
    if (nomeSalvo) setNome(nomeSalvo);
    if (centralSalva !== undefined) setDispositivoId(centralSalva);
    if (telefoneSalvo) setTelefone(telefoneSalvo);
    if (residenciaSalva) setResidencia(residenciaSalva);
    if (cepSalvo) setCep(cepSalvo);
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
      cep: cep.trim()
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

            <Campo rotulo="Endereço da Residência" icone="home-outline">
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={residencia}
                  onChangeText={setResidencia}
                  placeholder="Rua, número, bairro e cidade"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="Endereço da Residência"
                />
              )}
            </Campo>

            <Campo rotulo="CEP" icone="location-outline">
              {(foco) => (
                <TextInput
                  {...foco}
                  style={styles.input}
                  value={cep}
                  onChangeText={setCep}
                  keyboardType="numeric"
                  placeholder="00000-000"
                  placeholderTextColor={C.textoTer}
                  accessibilityLabel="CEP"
                />
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
    </SafeAreaView>
  );
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
