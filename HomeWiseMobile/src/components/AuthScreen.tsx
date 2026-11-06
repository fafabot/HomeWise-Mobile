import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cadastrarUsuario, loginUsuario, recuperarPerfilIncompleto } from '@/services/authService';
import { authErrorMessage } from '@/services/authErrors';
import { mensagemPerfil } from '@/utils/profile-feedback';
import HomeWiseLogo from '@/components/HomeWiseLogo';
import { useAuth } from '@/contexts/AuthContext';
import { usePanelMotion } from '@/hooks/use-panel-motion';

export default function AuthScreen({ mode }: { mode: 'login' | 'cadastro' }) {
  const registering = mode === 'cadastro';
  const { selectEntry, user, perfil, estadoPerfil, operacaoPerfil, iniciarOperacaoPerfil,
    finalizarOperacaoPerfil, tentarNovamentePerfil, sairDaConta, saindo, erroSaida } = useAuth();
  const recuperando = registering && !!user;
  const panel = usePanelMotion();
  const [focused, setFocused] = useState<string | null>(null);
  const [nome, setNome] = useState(user?.displayName || perfil?.nome || '');
  const [email, setEmail] = useState(user?.email || '');
  const [dispositivo, setDispositivo] = useState(perfil?.dispositivo_id || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [situacao, setSituacao] = useState<'inicial' | 'completo' | 'parcial' | 'falha'>('inicial');
  const [cadastroPendente, setCadastroPendente] = useState<{ uid: string } | null>(null);
  // Um cadastro novo em andamento (ou já concluído) recebe a sessão antes do resultado;
  // nesse intervalo a tela continua sendo de cadastro, não de conclusão de perfil.
  const [envioCadastro, setEnvioCadastro] = useState(false);
  const [cadastroNovoConcluido, setCadastroNovoConcluido] = useState(false);
  const modoConclusao = registering && (!!cadastroPendente || (recuperando && !envioCadastro && !cadastroNovoConcluido));
  // Após recarga/login o rascunho da central (só em memória) não existe mais.
  const centralPerdida = modoConclusao && !cadastroPendente && !dispositivo.trim() && !perfil?.dispositivo_id?.trim();
  const montada = useRef(true);
  const usuarioAtual = useRef(user?.uid);
  useEffect(() => { usuarioAtual.current = user?.uid; }, [user?.uid]);
  useEffect(() => {
    montada.current = true;
    return () => { montada.current = false; };
  }, []);
  const submitting = useRef(false);
  const emailInput = useRef<ComponentRef<typeof TextInput>>(null);
  const dispositivoInput = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null);

  async function submit() {
    if (submitting.current || (registering && situacao === 'completo')) return;
    submitting.current = true;
    setBusy(true);
    const uidInicial = usuarioAtual.current;
    let token: number | null = null;
    try {
      await panel.press();
      if (!montada.current) return;
      if (usuarioAtual.current !== uidInicial) {
        setError('A sessão mudou. Confira a conta antes de tentar novamente.');
        return;
      }
      setError('');
      const normalizedEmail = email.trim().toLowerCase();
      if (registering && (cadastroPendente || recuperando)) {
        const uidEsperado = cadastroPendente?.uid || user?.uid;
        if (usuarioAtual.current !== uidEsperado) {
          setError('Entre novamente na mesma conta para concluir o perfil. Não refaça o cadastro.');
          setSituacao('parcial');
          return;
        }
        token = iniciarOperacaoPerfil(user?.email || normalizedEmail);
        if (token === null) return;
        const resultado = await recuperarPerfilIncompleto({ nome: nome.trim(), dispositivo_id: dispositivo.trim() });
        finalizarOperacaoPerfil(token, resultado);
        token = null;
        if (!montada.current || usuarioAtual.current !== uidEsperado) return;
        setSituacao(resultado.sucesso && resultado.estado === 'completo' ? 'completo' : 'parcial');
        setError(mensagemPerfil(resultado, 'recuperacao'));
        return;
      }

      if (registering && !nome.trim()) {
        setError('Informe seu nome completo.');
        return;
      }

      const validationError = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? 'Informe um e-mail válido.'
        : !password ? 'Informe sua senha.'
        : registering && password.length < 6 ? 'A senha deve ter pelo menos 6 caracteres.'
        : registering && password !== confirmation ? 'As senhas não coincidem.' : '';

      if (validationError) {
        setError(validationError);
        return;
      }

      if (registering) {
        token = iniciarOperacaoPerfil(normalizedEmail);
        if (token === null) return;
        setEnvioCadastro(true);
        const res = await cadastrarUsuario(normalizedEmail, password, nome, dispositivo.trim());
        finalizarOperacaoPerfil(token, res);
        token = null;
        if (!montada.current || (usuarioAtual.current && usuarioAtual.current !== res.usuario?.uid)) return;
        if (res.sucesso && res.estado === 'completo') setCadastroNovoConcluido(true);
        setSituacao(res.sucesso && res.estado === 'completo' ? 'completo' : res.estado === 'parcial' ? 'parcial' : 'falha');
        if (res.estado === 'parcial' && res.usuario?.uid) setCadastroPendente({ uid: res.usuario.uid });
        setError(mensagemPerfil(res, 'cadastro'));
      } else {
        const res = await loginUsuario(normalizedEmail, password);
        if (!montada.current) return;
        if (!res.sucesso) {
          setError(authErrorMessage({ code: res.codigo }));
        }
      }
    } catch {
      if (montada.current) setError(cadastroPendente
        ? 'Não foi possível concluir o perfil. Tente novamente na mesma conta.'
        : 'Não foi possível confirmar a operação. Seus dados foram mantidos. Confira sua conexão antes de tentar novamente.');
    } finally {
      if (token !== null) finalizarOperacaoPerfil(token);
      submitting.current = false;
      if (montada.current) { setBusy(false); setEnvioCadastro(false); }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <ImageBackground source={require('../../assets/images/welcome-home.png')} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
              <View style={styles.shade} />
              {/* Na conclusão de perfil a sessão já existe: voltar não tem efeito; a saída é "Sair da conta". */}
              {!modoConclusao && <TouchableOpacity disabled={busy || recuperando} accessibilityRole="button" accessibilityLabel="Voltar para as boas-vindas" style={styles.back} onPress={() => panel.close(() => selectEntry(null))}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>}
              <HomeWiseLogo compact />
              <Text style={styles.brand}>HomeWise</Text>
            </ImageBackground>
            <Animated.View style={[styles.form, panel.style]}>
            <View style={styles.formContent}>
            <View style={styles.handle} />
            <Text style={styles.eyebrow}>{modoConclusao ? 'CONCLUSÃO DO PERFIL' : registering ? 'COMECE UMA NOVA HISTÓRIA' : 'SUA CASA ESTÁ ESPERANDO'}</Text>
            <Text style={styles.title}>{modoConclusao ? 'Conclua seu perfil' : registering ? 'Crie sua conta' : 'Bem-vindo de volta'}</Text>
            <Text style={styles.subtitle}>{modoConclusao
              ? 'Sua conta já existe. Confirme seu nome para concluir o perfil nesta mesma conta, sem criar outra conta nem informar a senha.'
              : registering ? 'Cadastre-se para acompanhar sua residência.' : 'Entre com seu e-mail e senha para continuar.'}</Text>

            {/* Campo Nome (Apenas Cadastro) */}
            {registering && (
              <>
                <Text style={styles.label}>Nome completo</Text>
                <View style={[styles.fieldRow, focused === 'nome' && styles.focused]}>
                  <Ionicons name="person-outline" size={20} color="#7f97a6" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Seu nome"
                    placeholderTextColor="#7f97a6"
                    value={nome}
                    onChangeText={setNome}
                    onFocus={() => setFocused('nome')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="words"
                    editable={!busy && !cadastroPendente && situacao !== 'completo'}
                    returnKeyType="next"
                    onSubmitEditing={() => emailInput.current?.focus()}
                  />
                </View>
              </>
            )}

            {/* Campo E-mail */}
            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.fieldRow, focused === 'email' && styles.focused]}>
              <Ionicons name="mail-outline" size={20} color="#7f97a6" style={styles.fieldIcon} />
              <TextInput
                ref={emailInput}
                style={styles.fieldInput}
                accessibilityLabel="E-mail"
                placeholder="voce@exemplo.com"
                placeholderTextColor="#7f97a6"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!recuperando && !busy && !cadastroPendente && situacao !== 'completo'}
                returnKeyType="next"
                onSubmitEditing={() => registering ? dispositivoInput.current?.focus() : passwordInput.current?.focus()}
              />
            </View>

            {/* Campo Código da Central (Apenas Cadastro) */}
            {registering && (
              <>
                <Text style={styles.label}>Código da Central (opcional, pode vincular depois)</Text>
                <View style={[styles.fieldRow, focused === 'dispositivo' && styles.focused]}>
                  <Ionicons name="hardware-chip-outline" size={20} color="#7f97a6" style={styles.fieldIcon} />
                  <TextInput
                    ref={dispositivoInput}
                    style={styles.fieldInput}
                    placeholder="Ex.: central_homewise_01"
                    placeholderTextColor="#7f97a6"
                    value={dispositivo}
                    onChangeText={setDispositivo}
                    onFocus={() => setFocused('dispositivo')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="none"
                    editable={!busy && !cadastroPendente && situacao !== 'completo'}
                    returnKeyType={modoConclusao ? 'go' : 'next'}
                    onSubmitEditing={() => modoConclusao ? void submit() : passwordInput.current?.focus()}
                  />
                </View>
                {centralPerdida && (
                  <Text style={styles.hint}>
                    Se você informou o código da central no cadastro, ele não foi mantido. Informe-o agora ou deixe em branco e vincule a central depois, em Editar perfil.
                  </Text>
                )}
              </>
            )}

            {/* Senhas: não são usadas para concluir o perfil de uma conta já criada */}
            {!modoConclusao && (
            <>
            <Text style={styles.label}>Senha</Text>
            <View style={[styles.fieldRow, focused === 'password' && styles.focused]}>
              <Ionicons name="lock-closed-outline" size={20} color="#7f97a6" style={styles.fieldIcon} />
              <TextInput
                ref={passwordInput}
                style={styles.fieldInput}
                accessibilityLabel="Senha"
                placeholder={registering ? 'Pelo menos 6 caracteres' : 'Sua senha'}
                placeholderTextColor="#7f97a6"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={registering ? 'new-password' : 'current-password'}
                textContentType={registering ? 'newPassword' : 'password'}
                editable={!busy && !cadastroPendente && situacao !== 'completo'}
                returnKeyType={registering ? 'next' : 'go'}
                onSubmitEditing={() => registering ? confirmationInput.current?.focus() : void submit()}
              />
              <TouchableOpacity style={styles.eye} accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} accessibilityRole="button" onPress={() => setVisible(!visible)}>
                <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color="#7f97a6" />
              </TouchableOpacity>
            </View>

            {!registering && !busy && <Link href="/recuperar-senha" style={styles.forgot}>Esqueceu sua senha?</Link>}

            {/* Campo Confirmar Senha (Apenas Cadastro) */}
            {registering && (
              <>
                <Text style={styles.label}>Confirmar senha</Text>
                <View style={[styles.fieldRow, focused === 'confirmation' && styles.focused]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#7f97a6" style={styles.fieldIcon} />
                  <TextInput
                    ref={confirmationInput}
                    style={styles.fieldInput}
                    accessibilityLabel="Confirmar senha"
                    placeholder="Repita sua senha"
                    placeholderTextColor="#7f97a6"
                    value={confirmation}
                    onChangeText={setConfirmation}
                    onFocus={() => setFocused('confirmation')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!visible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!busy && !cadastroPendente && situacao !== 'completo'}
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                  />
                </View>
              </>
            )}
            </>
            )}

            {recuperando && estadoPerfil === 'verificando' && <Text style={styles.subtitle}>Aguardando confirmação do perfil pelo servidor.</Text>}
            {recuperando && estadoPerfil === 'erro' && <Text style={styles.error}>Não foi possível consultar o perfil. Isso não significa que ele não existe.</Text>}
            {recuperando && <TouchableOpacity style={styles.link} disabled={busy || operacaoPerfil || saindo} onPress={tentarNovamentePerfil}><Text style={styles.link}>Tentar consultar perfil</Text></TouchableOpacity>}
            {!!error && <Text style={[styles.error, situacao === 'completo' && { color: '#22b7d4' }]} accessibilityRole={situacao === 'completo' ? undefined : 'alert'} accessibilityLiveRegion="polite">{error}</Text>}

            <Animated.View style={panel.buttonStyle}>
              <TouchableOpacity
                style={[styles.button, busy && styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || (registering && situacao === 'completo'), busy }}
                disabled={busy || (registering && situacao === 'completo')}
                onPressIn={panel.buttonDown}
                onPressOut={panel.buttonUp}
                onPress={() => void submit()}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.buttonText}>{registering ? situacao === 'completo' ? 'Perfil concluído' : (cadastroPendente || recuperando) ? 'Concluir meu perfil' : 'Criar minha conta' : 'Entrar'}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Saída pelo fluxo existente (sairDaConta): leva às boas-vindas; dá para entrar depois e concluir. */}
            {recuperando && (
              <>
                <TouchableOpacity
                  style={[styles.sair, saindo && styles.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Sair da conta"
                  accessibilityHint="Encerra a sessão neste aparelho. Você pode entrar depois para concluir o perfil."
                  accessibilityState={{ disabled: saindo, busy: saindo }}
                  disabled={saindo}
                  onPress={() => void sairDaConta()}
                >
                  <Ionicons name="log-out-outline" size={18} color="#22b7d4" />
                  <Text style={styles.sairTexto}>{saindo ? 'Saindo…' : 'Sair da conta'}</Text>
                </TouchableOpacity>
                <Text style={styles.sairNota}>Você pode entrar novamente depois e concluir o perfil nesta mesma conta.</Text>
              </>
            )}
            {erroSaida && <Text style={styles.error} accessibilityRole="alert">Não foi possível sair da conta. Tente novamente.</Text>}

            {!busy && !recuperando && (
              <>
                <Text style={styles.footer}>{registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.link}
                  onPress={() => selectEntry(registering ? 'login' : 'cadastro')}
                >
                  <Text style={styles.link}>{registering ? 'Entrar na minha conta' : 'Cadastre-se gratuitamente'}</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.security}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#7f97a6" />
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
  container: { flex: 1, backgroundColor: '#07131b' },
  scroll: { flexGrow: 1 },
  card: { flexGrow: 1, width: '100%', backgroundColor: '#07131b' },
  hero: { height: 220, backgroundColor: '#050e14', justifyContent: 'center', alignItems: 'center', paddingBottom: 18 },
  heroImage: { width: '100%', height: '100%' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 14, 20, 0.55)' },
  brand: { color: '#f1f7fa', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 6 },
  form: { flexGrow: 1, padding: 26, paddingTop: 14, backgroundColor: '#0b1c27', marginTop: -30, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, borderColor: '#173244' },
  formContent: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#21465c', alignSelf: 'center', marginBottom: 22 },
  back: { position: 'absolute', left: 16, top: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11, 28, 39, 0.75)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  eyebrow: { color: '#22b7d4', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, textAlign: 'center' },
  title: { color: '#f1f7fa', fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 10, textAlign: 'center' },
  subtitle: { color: '#9db1bd', lineHeight: 21, marginTop: 8, marginBottom: 8, textAlign: 'center', fontSize: 13.5 },
  label: { color: '#9db1bd', fontSize: 12.5, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: { color: '#f1f7fa', backgroundColor: '#07131b', borderWidth: 1, borderColor: '#173244', borderRadius: 14, padding: 15, fontSize: 15, minHeight: 54 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#07131b', borderWidth: 1, borderColor: '#173244', borderRadius: 14 },
  fieldIcon: { marginLeft: 15 },
  fieldInput: { flex: 1, minWidth: 0, color: '#f1f7fa', paddingHorizontal: 12, paddingVertical: 15, fontSize: 15, minHeight: 54 },
  focused: { borderColor: '#22b7d4', backgroundColor: '#050e14' },
  eye: { width: 46, minHeight: 50, justifyContent: 'center', alignItems: 'center' },
  hint: { color: '#9db1bd', fontSize: 12, lineHeight: 18, marginTop: 8 },
  error: { color: '#fca5a5', backgroundColor: '#261414', borderWidth: 1, borderColor: '#7f1d1d', padding: 12, borderRadius: 12, fontSize: 13, lineHeight: 20, marginTop: 16 },
  button: { backgroundColor: '#0a7d96', borderRadius: 16, minHeight: 54, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  forgot: { color: '#22b7d4', fontSize: 12.5, textAlign: 'right', paddingVertical: 12, fontWeight: '600' },
  footer: { color: '#7f97a6', fontSize: 12.5, textAlign: 'center', marginTop: 22 },
  sair: { borderWidth: 1, borderColor: '#21465c', borderRadius: 16, minHeight: 50, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  sairTexto: { color: '#d6e3ea', fontSize: 14.5, fontWeight: '700' },
  sairNota: { color: '#7f97a6', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  link: { color: '#22b7d4', fontSize: 13.5, fontWeight: '700', textAlign: 'center', paddingVertical: 10, lineHeight: 22 },
  security: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16 },
  securityText: { color: '#7f97a6', fontSize: 11 },
});
