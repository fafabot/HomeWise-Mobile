import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeWiseLogo from '@/components/HomeWiseLogo';
import { recuperarSenha } from '@/services/authService';
import { authErrorMessage } from '@/services/authErrors';
import { useAuth } from '@/contexts/AuthContext';

export default function RecoverPasswordScreen() {
  const { selectEntry } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Informe um e-mail válido.');
    submitting.current = true;
    setBusy(true);
    try {
      // Usa a função existente do authService. Conta inexistente recebe a mesma resposta de sucesso,
      // para não revelar quais e-mails estão cadastrados.
      const resultado = await recuperarSenha(normalizedEmail);
      if (resultado.sucesso || resultado.codigo === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage({ code: resultado.codigo }));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  // Volta para o login que já está na pilha; substituir esta tela criaria um segundo login escondido atrás.
  function voltarParaLogin() {
    selectEntry('login');
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <HomeWiseLogo />
            <Text style={styles.title}>Recupere sua senha</Text>
            {sent ? <>
              <Ionicons name="mail-open-outline" size={40} color="#22b7d4" style={styles.mail} />
              <Text style={styles.subtitle} accessibilityLiveRegion="polite">Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha. Confira também a caixa de spam.</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={voltarParaLogin}><Text style={styles.buttonText}>Voltar para o login</Text></TouchableOpacity>
            </> : <>
              <Text style={styles.subtitle}>Informe o e-mail da sua conta para receber um link de recuperação.</Text>
              <Text style={styles.label}>E-mail</Text>
              <TextInput style={styles.input} accessibilityLabel="E-mail da conta" placeholder="voce@exemplo.com" placeholderTextColor="#7f97a6" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} returnKeyType="send" onSubmitEditing={() => void submit()} />
              {!!error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}
              <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void submit()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar link</Text>}</TouchableOpacity>
              {!busy && <TouchableOpacity accessibilityRole="link" style={styles.linkArea} onPress={voltarParaLogin}><Text style={styles.link}>Voltar para o login</Text></TouchableOpacity>}
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07131b' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 36 },
  content: { maxWidth: 420, width: '100%', alignSelf: 'center', backgroundColor: '#0b1c27', borderRadius: 28, borderWidth: 1, borderColor: '#173244', paddingHorizontal: 24, paddingVertical: 30 },
  title: { color: '#f1f7fa', fontSize: 25, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', marginTop: 24 },
  subtitle: { color: '#9db1bd', textAlign: 'center', fontSize: 13.5, lineHeight: 22, marginTop: 10, marginBottom: 24 },
  label: { color: '#9db1bd', fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  input: { color: '#f1f7fa', backgroundColor: '#07131b', borderRadius: 14, borderWidth: 1, borderColor: '#173244', padding: 15, fontSize: 15, minHeight: 54 },
  button: { backgroundColor: '#0a7d96', color: '#fff', textAlign: 'center', borderRadius: 16, overflow: 'hidden', paddingVertical: 17, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 24, fontWeight: '700', fontSize: 15 },
  buttonText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: '#fca5a5', backgroundColor: '#261414', borderWidth: 1, borderColor: '#7f1d1d', padding: 12, borderRadius: 12, lineHeight: 20, marginTop: 16, fontSize: 13 },
  linkArea: { minHeight: 48, justifyContent: 'center', marginTop: 6 },
  link: { color: '#22b7d4', paddingVertical: 12, textAlign: 'center', fontSize: 13.5, fontWeight: '700' },
  mail: { alignSelf: 'center', marginTop: 20 },
});
