import { showAlert } from '@/utils/alert';
import React, { useRef, useState } from 'react';
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
import { alterarSenhaUsuario } from '@/services/authService';
import { C, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

export default function AlterarSenhaScreen() {
  const router = useRouter();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  // O Enter do teclado (onSubmitEditing) não respeita o botão desabilitado: o ref impede envio duplicado
  const enviando = useRef(false);

  async function handleSalvarSenha() {
    if (enviando.current) return;
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      showAlert('Atenção', 'Preencha todos os campos.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      showAlert('Erro', 'A nova senha e a confirmação não coincidem.');
      return;
    }

    if (novaSenha.length < 6) {
      showAlert('Erro', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    enviando.current = true;
    setCarregando(true);
    const resultado = await alterarSenhaUsuario(senhaAtual, novaSenha);
    enviando.current = false;
    setCarregando(false);

    if (resultado.sucesso) {
      showAlert('Sucesso', 'Senha alterada com sucesso!', [
        { text: 'OK', onPress: () => router.push('/perfil') }
      ]);
    } else {
      showAlert('Erro', resultado.erro || 'Não foi possível alterar a senha.');
    }
  }


  // Apenas indicação visual dos mesmos critérios validados em handleSalvarSenha
  const criterios = [
    { ok: novaSenha.length >= 6, texto: 'Mínimo de 6 caracteres' },
    { ok: !!confirmarSenha && novaSenha === confirmarSenha, texto: 'Confirmação igual à nova senha' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.conteudo}>

          <CabecalhoTela titulo="Alterar Senha" onVoltar={() => router.push('/perfil')} />

          {/* Card informativo de segurança */}
          <View style={styles.cardAviso}>
            <View style={styles.avisoIcone}>
              <Ionicons name="shield-checkmark" size={22} color={C.marca} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.avisoTitulo}>Proteção da sua conta</Text>
              <Text style={styles.avisoDesc}>
                A sua senha é criptografada e gerenciada com segurança pelo Firebase Authentication.
              </Text>
            </View>
          </View>

          {/* Formulário */}
          <View style={styles.formCard}>
            <CampoSenha
              rotulo="Senha Atual"
              valor={senhaAtual}
              onChange={setSenhaAtual}
              placeholder="Digite sua senha atual"
              visivel={mostrarSenhaAtual}
              tipo="atual"
              onAlternar={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
            />

            <View style={styles.divisor} />

            <CampoSenha
              rotulo="Nova Senha"
              valor={novaSenha}
              onChange={setNovaSenha}
              placeholder="Mínimo de 6 caracteres"
              visivel={mostrarNovaSenha}
              tipo="nova"
              onAlternar={() => setMostrarNovaSenha(!mostrarNovaSenha)}
            />

            <CampoSenha
              rotulo="Confirmar Nova Senha"
              valor={confirmarSenha}
              onChange={setConfirmarSenha}
              placeholder="Repita a nova senha"
              visivel={mostrarConfirmarSenha}
              onAlternar={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
              onEnviar={() => void handleSalvarSenha()}
              tipo="nova"
            />

            <View style={styles.criterios} accessibilityLiveRegion="polite">
              {criterios.map((criterio) => (
                <View key={criterio.texto} style={styles.criterio} accessible accessibilityLabel={`${criterio.texto}: ${criterio.ok ? 'atendido' : 'pendente'}`}>
                  <Ionicons name={criterio.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={criterio.ok ? C.ok : C.textoTer} />
                  <Text style={[styles.criterioTexto, criterio.ok && { color: C.texto }]}>{criterio.texto}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.botaoSalvar, carregando && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleSalvarSenha}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityState={{ disabled: carregando, busy: carregando }}
            >
              {carregando ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="key-outline" size={18} color="#ffffff" />
                  <Text style={styles.textoBotaoSalvar}>Atualizar Senha</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Campo de senha com destaque de foco e botão para mostrar/ocultar. */
function CampoSenha({ rotulo, valor, onChange, placeholder, visivel, onAlternar, tipo, onEnviar }: {
  rotulo: string;
  valor: string;
  onChange: (texto: string) => void;
  placeholder: string;
  visivel: boolean;
  onAlternar?: () => void;
  tipo: 'atual' | 'nova';
  onEnviar?: () => void;
}) {
  const [emFoco, setEmFoco] = useState(false);
  return (
    <View style={styles.inputGrupo}>
      <Text style={styles.label}>{rotulo}</Text>
      <View style={[styles.inputContainer, emFoco && styles.inputFoco]}>
        <Ionicons name="lock-closed-outline" size={17} color={emFoco ? C.marca : C.textoTer} />
        <TextInput
          style={styles.input}
          secureTextEntry={!visivel}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={tipo === 'atual' ? 'current-password' : 'new-password'}
          textContentType={tipo === 'atual' ? 'password' : 'newPassword'}
          returnKeyType={onEnviar ? 'go' : 'next'}
          onSubmitEditing={onEnviar}
          value={valor}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textoTer}
          accessibilityLabel={rotulo}
          onFocus={() => setEmFoco(true)}
          onBlur={() => setEmFoco(false)}
        />
        {onAlternar && (
          <TouchableOpacity
            onPress={onAlternar}
            style={styles.botaoOlho}
            accessibilityRole="button"
            accessibilityLabel={visivel ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
          >
            <Ionicons name={visivel ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textoSec} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fundo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  conteudo: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  cardAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: alfa(C.marca, 0.07),
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.28),
    marginBottom: 16
  },
  avisoIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: alfa(C.marca, 0.14), alignItems: 'center', justifyContent: 'center' },
  avisoTitulo: { color: C.texto, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  avisoDesc: { color: C.textoSec, fontSize: 12.5, lineHeight: 18 },
  formCard: {
    backgroundColor: C.superficie,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borda,
    gap: 16
  },
  divisor: { height: 1, backgroundColor: C.bordaSuave },
  inputGrupo: { gap: 7 },
  label: { fontSize: 13, fontWeight: '600', color: C.textoSec },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.fundo,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borda,
    paddingLeft: 14,
    paddingRight: 6
  },
  inputFoco: { borderColor: C.marca, backgroundColor: C.fundoProfundo },
  input: { flex: 1, height: 50, color: C.texto, fontSize: 15 },
  botaoOlho: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  criterios: { gap: 8, paddingHorizontal: 2 },
  criterio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  criterioTexto: { color: C.textoTer, fontSize: 12.5 },
  botaoSalvar: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.marcaForte,
    minHeight: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4
  },
  textoBotaoSalvar: { color: '#ffffff', fontSize: 15, fontWeight: '700' }
});
