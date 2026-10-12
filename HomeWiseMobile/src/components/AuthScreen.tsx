import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cadastrarUsuario, loginUsuario } from '@/services/authService';
import HomeWiseLogo from '@/components/HomeWiseLogo';
import { useAuth } from '@/contexts/AuthContext';
import { usePanelMotion } from '@/hooks/use-panel-motion';

export default function AuthScreen({ mode }: { mode: 'login' | 'cadastro' }) {
  const registering = mode === 'cadastro';
  const { selectEntry } = useAuth();
  const panel = usePanelMotion();
  const [focused, setFocused] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [dispositivo, setDispositivo] = useState('central_homewise_01');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const emailInput = useRef<TextInput>(null);
  const dispositivoInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    await panel.press();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    
    if (registering && !nome.trim()) {
      setError('Informe seu nome completo.');
      submitting.current = false;
      setBusy(false);
      return;
    }

    const validationError = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? 'Informe um e-mail válido.'
      : !password ? 'Informe sua senha.'
      : registering && password.length < 6 ? 'A senha deve ter pelo menos 6 caracteres.'
      : registering && password !== confirmation ? 'As senhas não coincidem.' : '';
    
    if (validationError) {
      setError(validationError);
      submitting.current = false;
      setBusy(false);
      return;
    }

    try {
      if (registering) {
        const res = await cadastrarUsuario(normalizedEmail, password, nome, dispositivo || 'central_homewise_01');
        if (!res.sucesso) {
          setError(res.erro || 'Erro ao criar conta.');
        }
      } else {
        const res = await loginUsuario(normalizedEmail, password);
        if (!res.sucesso) {
          setError(res.erro || 'Erro ao entrar na conta.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro inesperado.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#091321" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <ImageBackground source={require('../../assets/images/welcome-home.png')} style={styles.hero} resizeMode="cover">
              <View style={styles.shade} />
              <TouchableOpacity disabled={busy} accessibilityRole="button" accessibilityLabel="Voltar para as boas-vindas" style={styles.back} onPress={() => panel.close(() => selectEntry(null))}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
              <HomeWiseLogo compact />
              <Text style={styles.brand}>HomeWise</Text>
            </ImageBackground>
            <Animated.View style={[styles.form, panel.style]}>
            <View style={styles.formContent}>
            <View style={styles.handle} />
            <Text style={styles.eyebrow}>{registering ? 'COMECE UMA NOVA HISTÓRIA' : 'SUA CASA ESTÁ ESPERANDO'}</Text>
            <Text style={styles.title}>{registering ? 'Crie sua conta' : 'Bem-vindo de volta'}</Text>
            <Text style={styles.subtitle}>{registering ? 'Cadastre-se para acompanhar sua residência.' : 'Entre com seu e-mail e senha para continuar.'}</Text>

            {/* Campo Nome (Apenas Cadastro) */}
            {registering && (
              <>
                <Text style={styles.label}>Nome completo</Text>
                <View style={[styles.fieldRow, focused === 'nome' && styles.focused]}>
                  <Ionicons name="person-outline" size={20} color="#8196b3" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Seu nome"
                    placeholderTextColor="#95a5bd"
                    value={nome}
                    onChangeText={setNome}
                    onFocus={() => setFocused('nome')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="words"
                    editable={!busy}
                    returnKeyType="next"
                    onSubmitEditing={() => emailInput.current?.focus()}
                  />
                </View>
              </>
            )}

            {/* Campo E-mail */}
            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.fieldRow, focused === 'email' && styles.focused]}>
              <Ionicons name="mail-outline" size={20} color="#8196b3" style={styles.fieldIcon} />
              <TextInput
                ref={emailInput}
                style={styles.fieldInput}
                accessibilityLabel="E-mail"
                placeholder="voce@exemplo.com"
                placeholderTextColor="#95a5bd"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!busy}
                returnKeyType="next"
                onSubmitEditing={() => registering ? dispositivoInput.current?.focus() : passwordInput.current?.focus()}
              />
            </View>

            {/* Campo Código da Central (Apenas Cadastro) */}
            {registering && (
              <>
                <Text style={styles.label}>Código da Central HomeWise</Text>
                <View style={[styles.fieldRow, focused === 'dispositivo' && styles.focused]}>
                  <Ionicons name="hardware-chip-outline" size={20} color="#8196b3" style={styles.fieldIcon} />
                  <TextInput
                    ref={dispositivoInput}
                    style={styles.fieldInput}
                    placeholder="Ex: central_homewise_01"
                    placeholderTextColor="#95a5bd"
                    value={dispositivo}
                    onChangeText={setDispositivo}
                    onFocus={() => setFocused('dispositivo')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="none"
                    editable={!busy}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInput.current?.focus()}
                  />
                </View>
              </>
            )}

            {/* Campo Senha */}
            <Text style={styles.label}>Senha</Text>
            <View style={[styles.fieldRow, focused === 'password' && styles.focused]}>
              <Ionicons name="lock-closed-outline" size={20} color="#8196b3" style={styles.fieldIcon} />
              <TextInput
                ref={passwordInput}
                style={styles.fieldInput}
                accessibilityLabel="Senha"
                placeholder={registering ? 'Pelo menos 6 caracteres' : 'Sua senha'}
                placeholderTextColor="#95a5bd"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={registering ? 'new-password' : 'current-password'}
                textContentType={registering ? 'newPassword' : 'password'}
                editable={!busy}
                returnKeyType={registering ? 'next' : 'go'}
                onSubmitEditing={() => registering ? confirmationInput.current?.focus() : void submit()}
              />
              <TouchableOpacity style={styles.eye} accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} accessibilityRole="button" onPress={() => setVisible(!visible)}>
                <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color="#8196b3" />
              </TouchableOpacity>
            </View>

            {!registering && !busy && <Link href="/recuperar-senha" style={styles.forgot}>Esqueceu sua senha?</Link>}

            {/* Campo Confirmar Senha (Apenas Cadastro) */}
            {registering && (
              <>
                <Text style={styles.label}>Confirmar senha</Text>
                <TextInput
                  ref={confirmationInput}
                  style={[styles.input, focused === 'confirmation' && styles.focused]}
                  accessibilityLabel="Confirmar senha"
                  placeholder="Repita sua senha"
                  placeholderTextColor="#95a5bd"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  onFocus={() => setFocused('confirmation')}
                  onBlur={() => setFocused(null)}
                  secureTextEntry={!visible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!busy}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
              </>
            )}

            {!!error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}

            <Animated.View style={panel.buttonStyle}>
              <TouchableOpacity
                style={[styles.button, busy && styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPressIn={panel.buttonDown}
                onPressOut={panel.buttonUp}
                onPress={() => void submit()}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.buttonText}>{registering ? 'Criar minha conta' : 'Entrar'}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {!busy && (
              <>
                <Text style={styles.footer}>{registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}</Text>
                <Link
                  href={registering ? '/login' : '/cadastro'}
                  replace
                  style={styles.link}
                  onPress={() => selectEntry(registering ? 'login' : 'cadastro')}
                >
                  {registering ? 'Entrar na minha conta' : 'Cadastre-se gratuitamente'}
                </Link>
              </>
            )}

            <View style={styles.security}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#7992b3" />
              <Text style={styles.securityText}>Seu acesso protegido, sua casa conectada.</Text>
            </View>

            </View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#091321' },
  scroll: { flexGrow: 1 },
  card: { flexGrow: 1, width: '100%', backgroundColor: '#091321' },
  hero: { height: 210, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', paddingBottom: 16 },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  brand: { color: '#fff', fontSize: 21, fontWeight: '600', marginTop: 5 },
  form: { flexGrow: 1, padding: 28, paddingTop: 16, backgroundColor: '#101f33', marginTop: -28, borderTopLeftRadius: 34, borderTopRightRadius: 34 },
  formContent: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#3d5878', alignSelf: 'center', marginBottom: 22 },
  back: { position: 'absolute', left: 16, top: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  eyebrow: { color: '#82baff', fontSize: 9, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center' },
  title: { color: '#f0f6ff', fontSize: 27, fontWeight: '800', letterSpacing: -0.8, marginTop: 10, textAlign: 'center' },
  subtitle: { color: '#a0b3ce', lineHeight: 21, marginTop: 9, marginBottom: 8, textAlign: 'center', fontSize: 13 },
  label: { color: '#c0d1e8', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: { color: '#f0f6ff', backgroundColor: '#192c45', borderWidth: 1, borderColor: '#29415f', borderRadius: 14, padding: 15, fontSize: 15, minHeight: 54 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#192c45', borderWidth: 1, borderColor: '#29415f', borderRadius: 14 },
  fieldIcon: { marginLeft: 15 },
  fieldInput: { flex: 1, minWidth: 0, color: '#f0f6ff', paddingHorizontal: 12, paddingVertical: 15, fontSize: 15, minHeight: 54 },
  focused: { borderColor: '#77b0ff', backgroundColor: '#203c60' },
  eye: { width: 46, minHeight: 50, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#ffb0a3', backgroundColor: '#3a2526', padding: 12, borderRadius: 12, fontSize: 13, lineHeight: 21, marginTop: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 28, minHeight: 54, flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  forgot: { color: '#82baff', fontSize: 12, textAlign: 'right', paddingVertical: 12, fontWeight: '500' },
  footer: { color: '#8b9ab1', fontSize: 12, textAlign: 'center', marginTop: 22 },
  link: { color: '#8dc4ff', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 10, lineHeight: 22 },
  security: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 16 },
  securityText: { color: '#8b9ab1', fontSize: 10 },
});
