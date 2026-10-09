import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { loginUsuario, cadastrarUsuario } from "./authService";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isCadastro, setIsCadastro] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleAcao() {
    if (!email || !senha) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }

    setCarregando(true);
    const resultado = isCadastro
      ? await cadastrarUsuario(email, senha)
      : await loginUsuario(email, senha);

    setCarregando(false);
    if (!resultado.sucesso) {
      Alert.alert("Erro", resultado.erro);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>Home<Text style={styles.logoSpan}>Wise</Text></Text>
        <Text style={styles.subtitulo}>
          {isCadastro ? "Crie sua conta para começar" : "Acesse o painel da sua residência"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#64748b"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity
          style={styles.botaoPrincipal}
          onPress={handleAcao}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.textoBotao}>
              {isCadastro ? "Cadastrar" : "Entrar"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoAlternar}
          onPress={() => setIsCadastro(!isCadastro)}
        >
          <Text style={styles.textoAlternar}>
            {isCadastro
              ? "Já tem conta? Clique aqui para entrar"
              : "Não possui conta? Cadastre-se gratuitamente"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07131b",
    justifyContent: "center",
    padding: 20
  },
  card: {
    backgroundColor: "#0e222e",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#162e3d"
  },
  logo: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center"
  },
  logoSpan: {
    color: "#22b7d4"
  },
  subtitulo: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
    fontSize: 14
  },
  input: {
    backgroundColor: "#07131b",
    color: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e3a4b"
  },
  botaoPrincipal: {
    backgroundColor: "#0284c7",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8
  },
  textoBotao: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold"
  },
  botaoAlternar: {
    marginTop: 18,
    alignItems: "center"
  },
  textoAlternar: {
    color: "#38bdf8",
    fontSize: 13
  }
});

