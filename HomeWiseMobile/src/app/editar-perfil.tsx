import React, { useState } from 'react';
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
import { obterUsuarioAtual, atualizarPerfilUsuario } from '@/services/authService';

export default function EditarPerfilScreen() {
  const router = useRouter();
  const usuario = obterUsuarioAtual();

  const [nome, setNome] = useState(usuario?.displayName || '');
  const [email] = useState(usuario?.email || '');
  const [telefone, setTelefone] = useState('+55 (11) 99999-9999');
  const [residencia, setResidencia] = useState('Rua Belforte 291 Santo André-SP');
  const [cep, setCep] = useState('04787-140');
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }

    setSalvando(true);
    const resultado = await atualizarPerfilUsuario(nome);
    setSalvando(false);

    if (resultado.sucesso) {
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.push('/perfil') }
      ]);
    } else {
      Alert.alert('Erro', resultado.erro || 'Não foi possível salvar as alterações.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7} onPress={() => router.push('/perfil')}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Editar Perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Foto de Perfil com Botao de Editar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarGrande}>
            <Text style={styles.avatarTexto}>
              {nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={styles.botaoTrocarFoto} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={16} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.nomeHeader}>{nome}</Text>
        </View>

        {/* Formulario dos Dados Pessoais do Figma */}
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

          {/* Campo E-mail (Desabilitado) */}
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

          {/* Campo Telefone */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Telefone</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
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
                placeholderTextColor="#64748b"
              />
              <Ionicons name="pencil" size={16} color="#0284c7" />
            </View>
          </View>

          {/* Botao Salvar */}
          <TouchableOpacity
            style={styles.botaoSalvar}
            activeOpacity={0.8}
            onPress={handleSalvar}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.textoBotaoSalvar}>Salvar Alterações</Text>
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
    paddingTop: 12,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative'
  },
  avatarGrande: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1b3b4f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22b7d4'
  },
  avatarTexto: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold'
  },
  botaoTrocarFoto: {
    position: 'absolute',
    bottom: 30,
    right: '38%',
    backgroundColor: '#0284c7',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#07131b'
  },
  nomeHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12
  },
  formCard: {
    backgroundColor: '#0b1d28',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#133547'
  },
  inputGrupo: {
    marginBottom: 16
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07131b',
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1e3a4b'
  },
  inputBloqueado: {
    backgroundColor: '#0a1620',
    borderColor: '#162b3a'
  },
  input: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 12,
    fontSize: 15
  },
  botaoSalvar: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10
  },
  textoBotaoSalvar: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
