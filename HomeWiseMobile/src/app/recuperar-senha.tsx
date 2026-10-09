import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeWiseLogo from '@/components/HomeWiseLogo';
import { auth } from '@/services/firebase';
import { authErrorMessage } from '@/services/authErrors';

export default function RecoverPasswordScreen() {
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
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSent(true);
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <HomeWiseLogo />
            <Text style={styles.title}>Recupere sua senha</Text>
            {sent ? <>
              <Ionicons name="mail-open-outline" size={40} color="#7cbfff" style={styles.mail} />
              <Text style={styles.subtitle} accessibilityLiveRegion="polite">Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha. Confira também a caixa de spam.</Text>
              <Link href="/login" replace style={styles.button}>Voltar para o login</Link>
            </> : <>
              <Text style={styles.subtitle}>Informe o e-mail da sua conta para receber um link de recuperação.</Text>
              <Text style={styles.label}>E-mail</Text>
              <TextInput style={styles.input} accessibilityLabel="E-mail da conta" placeholder="voce@exemplo.com" placeholderTextColor="#9aa7bb" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} returnKeyType="send" onSubmitEditing={() => void submit()} />
              {!!error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}
              <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void submit()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar link</Text>}</TouchableOpacity>
              {!busy && <Link href="/login" replace style={styles.link}>Voltar para o login</Link>}
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
  content: { maxWidth: 360, width: '100%', alignSelf: 'center' },
  title: { color: '#fff', fontSize: 23, fontWeight: '700', textAlign: 'center', marginTop: 30 },
  subtitle: { color: '#a9b3c5', textAlign: 'center', fontSize: 13, lineHeight: 22, marginTop: 12, marginBottom: 24 },
  label: { color: '#c6cddb', fontSize: 13, marginBottom: 8 },
  input: { color: '#fff', backgroundColor: '#2c5076', borderRadius: 7, borderWidth: 1, borderColor: '#365e88', padding: 14, fontSize: 15, minHeight: 50 },
  button: { backgroundColor: '#254e88', color: '#fff', textAlign: 'center', borderRadius: 7, overflow: 'hidden', paddingVertical: 16, alignItems: 'center', marginTop: 24, fontWeight: '600' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  error: { color: '#f87171', lineHeight: 21, marginTop: 16 },
  link: { color: '#7cbfff', paddingVertical: 20, textAlign: 'center', fontSize: 13 },
  mail: { alignSelf: 'center', marginTop: 24 },
});
