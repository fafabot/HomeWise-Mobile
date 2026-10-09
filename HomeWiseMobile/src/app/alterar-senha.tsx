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
import { alterarSenhaUsuario } from '@/services/authService';

export default function AlterarSenhaScreen() {
  const router = useRouter();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSalvarSenha() {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'A nova senha e a confirmação não coincidem.');
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setCarregando(true);
    const resultado = await alterarSenhaUsuario(senhaAtual, novaSenha);
    setCarregando(false);

    if (resultado.sucesso) {
      Alert.alert('Sucesso', 'Senha alterada com sucesso!', [
        { text: 'OK', onPress: () => router.push('/perfil') }
      ]);
    } else {
      Alert.alert('Erro', resultado.erro || 'Não foi possível alterar a senha.');
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
          <Text style={styles.tituloHeader}>Alterar Senha</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Card Informativo de Seguranca */}
        <View style={styles.cardAviso}>
          <Ionicons name="shield-checkmark" size={24} color="#38bdf8" />
          <View style={{ flex: 1 }}>
            <Text style={styles.avisoTitulo}>Proteção da sua conta</Text>
            <Text style={styles.avisoDesc}>
              A sua senha é criptografada e gerenciada com segurança pelo Firebase Authentication.
            </Text>
          </View>
        </View>

        {/* Formulario */}
        <View style={styles.formCard}>
          {/* Senha Atual */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Senha Atual</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                secureTextEntry={!mostrarSenhaAtual}
                value={senhaAtual}
                onChangeText={setSenhaAtual}
                placeholder="Digite sua senha atual"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity onPress={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}>
                <Ionicons
                  name={mostrarSenhaAtual ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Nova Senha */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Nova Senha</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                secureTextEntry={!mostrarNovaSenha}
                value={novaSenha}
                onChangeText={setNovaSenha}
                placeholder="Mínimo de 6 caracteres"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity onPress={() => setMostrarNovaSenha(!mostrarNovaSenha)}>
                <Ionicons
                  name={mostrarNovaSenha ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmar Nova Senha */}
          <View style={styles.inputGrupo}>
            <Text style={styles.label}>Confirmar Nova Senha</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                secureTextEntry={!mostrarNovaSenha}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                placeholder="Repita a nova senha"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          {/* Botao de Salvar Senha */}
          <TouchableOpacity
            style={styles.botaoSalvar}
            activeOpacity={0.8}
            onPress={handleSalvarSenha}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.textoBotaoSalvar}>Atualizar Senha</Text>
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
  cardAviso: {
    backgroundColor: '#0a2333',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#144c66'
  },
  avisoTitulo: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold'
  },
  avisoDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16
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
