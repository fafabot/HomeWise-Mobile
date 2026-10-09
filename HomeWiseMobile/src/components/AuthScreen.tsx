import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { authErrorMessage } from '@/services/authErrors';
import HomeWiseLogo from '@/components/HomeWiseLogo';

export default function AuthScreen({ mode }: { mode: 'login' | 'cadastro' }) {
  const registering = mode === 'cadastro';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const passwordInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);

  async function submit() {
    if (submitting.current) return;
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Informe um e-mail válido.');
    if (!password) return setError('Informe sua senha.');
    if (registering && password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    if (registering && password !== confirmation) return setError('As senhas não coincidem.');
    submitting.current = true;
    setBusy(true);
    try {
      if (registering) await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      else await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {registering && <Link href="/login" replace accessibilityLabel="Voltar para o login" style={styles.back}><Ionicons name="chevron-back" size={24} color="#fff" /></Link>}
            <HomeWiseLogo compact={registering} />
            <Text style={styles.title}>{registering ? 'Crie sua conta' : 'Bem-vindo de volta'}</Text>
            <Text style={styles.subtitle}>{registering ? 'Cadastre-se para acompanhar sua casa.' : 'Entre com seu e-mail e senha para continuar.'}</Text>
            <Text style={styles.label}>E-mail</Text>
            <TextInput style={styles.input} accessibilityLabel="E-mail" placeholder="voce@exemplo.com" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput ref={passwordInput} style={styles.passwordInput} accessibilityLabel="Senha" placeholder={registering ? 'Pelo menos 6 caracteres' : 'Sua senha'} placeholderTextColor="#64748b" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={registering ? 'new-password' : 'current-password'} textContentType={registering ? 'newPassword' : 'password'} editable={!busy} returnKeyType={registering ? 'next' : 'go'} onSubmitEditing={() => registering ? confirmationInput.current?.focus() : void submit()} />
              <TouchableOpacity style={styles.eye} accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} accessibilityRole="button" onPress={() => setVisible(!visible)}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#94a3b8" /></TouchableOpacity>
            </View>
            {!registering && !busy && <Link href="/recuperar-senha" style={styles.forgot}>Esqueceu sua senha?</Link>}
            {registering && <>
              <Text style={styles.label}>Confirmar senha</Text>
              <TextInput ref={confirmationInput} style={styles.input} accessibilityLabel="Confirmar senha" placeholder="Repita sua senha" placeholderTextColor="#64748b" value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
            </>}
            {!!error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}
            <TouchableOpacity style={[styles.button, busy && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void submit()}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{registering ? 'Criar conta' : 'Entrar'}</Text>}
            </TouchableOpacity>
            {!busy && <>
              <Text style={styles.footer}>{registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}</Text>
              <Link href={registering ? '/login' : '/cadastro'} replace style={styles.link}>{registering ? 'Entrar na minha conta' : 'Cadastre-se gratuitamente'}</Link>
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191e2a' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 36 },
  card: { width: '100%', maxWidth: 360, alignSelf: 'center' },
  back: { position: 'absolute', left: -8, top: 4, padding: 10, zIndex: 1 },
  title: { color: '#fff', fontSize: 23, fontWeight: '700', marginTop: 30, textAlign: 'center' },
  subtitle: { color: '#a9b3c5', lineHeight: 21, marginTop: 9, marginBottom: 18, textAlign: 'center', fontSize: 13 },
  label: { color: '#c6cddb', fontSize: 13, fontWeight: '500', marginBottom: 7, marginTop: 16 },
  input: { color: '#fff', backgroundColor: '#2c5076', borderWidth: 1, borderColor: '#365e88', borderRadius: 7, padding: 14, fontSize: 15, minHeight: 50 },
  passwordRow: { flexDirection: 'row', backgroundColor: '#2c5076', borderWidth: 1, borderColor: '#365e88', borderRadius: 7 },
  passwordInput: { flex: 1, color: '#fff', padding: 14, fontSize: 16, minHeight: 50 },
  eye: { paddingHorizontal: 14, justifyContent: 'center' },
  error: { color: '#f87171', lineHeight: 21, marginTop: 16 },
  button: { backgroundColor: '#254e88', borderRadius: 7, borderWidth: 1, borderColor: '#3463a0', minHeight: 50, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  forgot: { color: '#b9c8df', fontSize: 12, textAlign: 'right', paddingVertical: 12 },
  footer: { color: '#9aa7bb', fontSize: 12, textAlign: 'center', marginTop: 27 },
  link: { color: '#7cbfff', fontSize: 13, textAlign: 'center', paddingVertical: 12, lineHeight: 22 },
});
