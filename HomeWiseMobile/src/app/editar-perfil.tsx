import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { atualizarPerfilUsuario } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePhoto from '@/components/ProfilePhoto';

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

  const { nome: nomeSalvo, dispositivo_id: centralSalva, telefone: telefoneSalvo, residencia: residenciaSalva, cep: cepSalvo } = perfil ?? {};
  useEffect(() => {
    if (nomeSalvo) setNome(nomeSalvo);
    if (centralSalva !== undefined) setDispositivoId(centralSalva);
    if (telefoneSalvo) setTelefone(telefoneSalvo);
    if (residenciaSalva) setResidencia(residenciaSalva);
    if (cepSalvo) setCep(cepSalvo);
  }, [nomeSalvo, centralSalva, telefoneSalvo, residenciaSalva, cepSalvo]);

  async function handleSalvar() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }

    if (!dispositivoId.trim()) {
      Alert.alert('Atenção', 'Informe o identificador da sua Central HomeWise.');
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
      Alert.alert('Sucesso', 'Perfil e Central atualizados com sucesso!', [
        { text: 'OK', onPress: () => router.push('/perfil') }
      ]);
    } else {
      Alert.alert('Erro', resultado.erro || 'Não foi possível salvar as alterações.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7} onPress={() => router.push('/perfil')}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Editar Perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Foto de Perfil */}
        <View style={styles.avatarContainer}>
          <ProfilePhoto nome={nome} size={86} disabled={salvando} />
          <Text style={styles.nomeHeader}>{nome || 'Morador'}</Text>
        </View>

        {/* Formulario */}
        <View style={styles.formCard}>
          {/* Campo Nome */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Nome Completo</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome"
                placeholderTextColor="#64748b"
              />
              <Ionicons name="pencil" size={16} color="#0284c7" />
            </View>
          </View>

          {/* Campo E-mail (Bloqueado) */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>E-mail da Conta</Text>
            <View style={[styles.inputContainer, styles.inputBloqueado]}>
              <TextInput
                style={[styles.input, { color: '#94a3b8' }]}
                value={email}
                editable={false}
              />
              <Ionicons name="lock-closed" size={16} color="#64748b" />
            </View>
          </View>

          {/* Campo Codigo da Central */}
          <View style={styles.inputGrupo}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <Text style={styles.label}>Código da Central HomeWise</Text>
              <TouchableOpacity
                style={styles.botaoScanPequeno}
                activeOpacity={0.7}
                onPress={() => router.push('/escanear-qrcode' as any)}
              >
                <Ionicons name="qr-code-outline" size={13} color="#22d3ee" style={{ marginRight: 4 }} />
                <Text style={styles.textoScanPequeno}>Escanear QR Code</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={dispositivoId}
                onChangeText={setDispositivoId}
                placeholder="Ex: central_homewise_01"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => router.push('/escanear-qrcode' as any)} activeOpacity={0.7} style={{ padding: 4 }}>
                <Ionicons name="camera-outline" size={20} color="#22d3ee" />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Este código vincula os sensores de água e energia da sua casa à sua conta.
            </Text>
          </View>

          {/* Campo Telefone */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Telefone</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder="(11) 99999-9999"
                placeholderTextColor="#64748b"
              />
              <Ionicons name="pencil" size={16} color="#0284c7" />
            </View>
          </View>

          {/* Campo Residencia */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Endereço da Residência</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={residencia}
                onChangeText={setResidencia}
                placeholder="Rua, número, bairro e cidade"
                placeholderTextColor="#64748b"
              />
              <Ionicons name="pencil" size={16} color="#0284c7" />
            </View>
          </View>

          {/* Campo CEP */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>CEP</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={cep}
                onChangeText={setCep}
                keyboardType="numeric"
                placeholder="00000-000"
                placeholderTextColor="#64748b"
              />
              <Ionicons name="pencil" size={16} color="#0284c7" />
            </View>
          </View>

          {/* Botao Salvar */}
          <TouchableOpacity
            style={[styles.botaoSalvar, salvando && { opacity: 0.7 }]}
            activeOpacity={0.8}
            onPress={handleSalvar}
            disabled={salvando}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16
  },
  botaoVoltar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0c202d',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e3a4f'
  },
  tituloHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff'
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
    position: 'relative'
  },
  avatarGrande: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#38bdf8'
  },
  avatarTexto: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff'
  },
  botaoTrocarFoto: {
    position: 'absolute',
    bottom: 30,
    right: '38%',
    backgroundColor: '#0ea5e9',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#07131b'
  },
  nomeHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12
  },
  formCard: {
    backgroundColor: '#0c202d',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e3a4f',
    gap: 16
  },
  inputGrupo: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07131b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3a4f',
    paddingHorizontal: 14
  },
  inputBloqueado: {
    backgroundColor: '#091924',
    borderColor: '#152b3c'
  },
  input: {
    flex: 1,
    height: 48,
    color: '#ffffff',
    fontSize: 14
  },
  helperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  botaoSalvar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    height: 50,
    borderRadius: 14,
    marginTop: 12
  },
  botaoSalvarTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff'
  },
  botaoScanPequeno: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)'
  },
  textoScanPequeno: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '600'
  }
});
