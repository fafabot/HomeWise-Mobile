import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import {
  obterPlanoPorId,
  planos,
  temPlanoAtivo,
  type CicloAssinatura,
  type Plano,
} from '@/constants/planos';
import { PlanBenefits, PlanPrice, SubscriptionScreen, subscriptionStyles as s } from '@/components/SubscriptionUI';

type MetodoPagamento = 'pix' | 'cartao';

// Tempo em que a confirmação do pagamento simulado fica visível
const DURACAO_CONFIRMACAO_MS = 5000;

export default function GerenciarAssinaturaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const { user, perfil, atualizarPlanoAssinatura, cancelarAssinatura } = useAuth();
  const ativo = temPlanoAtivo(perfil?.plano, perfil?.status_assinatura);
  const planoSalvo = ativo ? obterPlanoPorId(perfil?.plano) : null;

  const [ciclo, setCiclo] = useState<CicloAssinatura>(
    perfil?.ciclo_assinatura === 'anual' ? 'anual' : 'mensal'
  );
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string>('');
  const [mensagemErro, setMensagemErro] = useState(false);
  // Cancelar é destrutivo: pede confirmação antes de chamar cancelarAssinatura()
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  // Estados do modal de simulação de pagamento (Checkout)
  const [planoEmCheckout, setPlanoEmCheckout] = useState<Plano | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento>('pix');
  const [pixCopiado, setPixCopiado] = useState(false);
  const [numCartao, setNumCartao] = useState('');
  const [nomeCartao, setNomeCartao] = useState('');
  const [validadeCartao, setValidadeCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [erroPagamento, setErroPagamento] = useState('');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Confirmação temporária do pagamento simulado: fica só em memória, some após 5 s
  // e não reaparece ao reabrir ou recarregar a tela.
  const [confirmacao, setConfirmacao] = useState('');
  const temporizadorConfirmacao = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      if (temporizadorConfirmacao.current) clearTimeout(temporizadorConfirmacao.current);
      temporizadorConfirmacao.current = null;
    };
  }, []);

  function mostrarConfirmacao(texto: string) {
    // O pagamento pode terminar depois que a pessoa saiu da tela: nesse caso não cria temporizador
    if (!montada.current) return;
    if (temporizadorConfirmacao.current) clearTimeout(temporizadorConfirmacao.current);
    setConfirmacao(texto);
    temporizadorConfirmacao.current = setTimeout(() => {
      temporizadorConfirmacao.current = null;
      setConfirmacao('');
    }, DURACAO_CONFIRMACAO_MS);
  }

  function esconderConfirmacao() {
    if (temporizadorConfirmacao.current) clearTimeout(temporizadorConfirmacao.current);
    temporizadorConfirmacao.current = null;
    setConfirmacao('');
  }

  const [cicloSincronizado, setCicloSincronizado] = useState(perfil?.ciclo_assinatura);
  if (cicloSincronizado !== perfil?.ciclo_assinatura) {
    setCicloSincronizado(perfil?.ciclo_assinatura);
    if (perfil?.ciclo_assinatura === 'anual' || perfil?.ciclo_assinatura === 'mensal') {
      setCiclo(perfil.ciclo_assinatura);
    }
  }

  const [checkoutSincronizado, setCheckoutSincronizado] = useState<string | undefined>(undefined);
  if (checkoutSincronizado !== params.checkout) {
    setCheckoutSincronizado(params.checkout);
    if (params.checkout) {
      const p = obterPlanoPorId(params.checkout);
      if (p) abrirCheckout(p);
    }
  }

  function abrirCheckout(plano: Plano) {
    setErroPagamento('');
    setPixCopiado(false);
    if (!nomeCartao && (perfil?.nome || user?.displayName)) {
      setNomeCartao((perfil?.nome || user?.displayName || '').toUpperCase());
    }
    setPlanoEmCheckout(plano);
  }

  function formatarCartao(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 16);
    setNumCartao(digitos.replace(/(\d{4})(?=\d)/g, '$1 '));
  }

  function formatarValidade(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 4);
    if (digitos.length <= 2) setValidadeCartao(digitos);
    else setValidadeCartao(`${digitos.slice(0, 2)}/${digitos.slice(2)}`);
  }

  async function confirmarPagamentoSimulado() {
    if (!planoEmCheckout || processandoPagamento) return;
    setErroPagamento('');

    if (metodo === 'cartao') {
      const digitosCartao = numCartao.replace(/\D/g, '');
      const digitosValidade = validadeCartao.replace(/\D/g, '');
      const mes = Number(digitosValidade.slice(0, 2));
      if (digitosCartao.length < 16) {
        setErroPagamento('Informe os 16 dígitos do cartão.');
        return;
      }
      if (nomeCartao.trim().length < 3) {
        setErroPagamento('Informe o nome impresso no cartão.');
        return;
      }
      if (digitosValidade.length < 4 || mes < 1 || mes > 12) {
        setErroPagamento('Informe uma validade válida (MM/AA).');
        return;
      }
      if (cvvCartao.replace(/\D/g, '').length < 3) {
        setErroPagamento('Informe o código CVV de 3 ou 4 dígitos.');
        return;
      }
    }

    setProcessandoPagamento(true);
    setSalvandoId(planoEmCheckout.id);
    try {
      // Simula tempo de aprovação da transação
      await new Promise(resolve => setTimeout(resolve, 900));
      const ok = await atualizarPlanoAssinatura(planoEmCheckout.id, ciclo);
      if (ok) {
        const metodoLabel = metodo === 'pix' ? 'PIX' : 'Cartão de Crédito';
        setMensagem('');
        setMensagemErro(false);
        setConfirmandoCancelamento(false);
        mostrarConfirmacao(
          `Plano HomeWise ${planoEmCheckout.nome} (${ciclo}) ativado. Pagamento via ${metodoLabel} simulado.`
        );
        setPlanoEmCheckout(null);
      } else {
        setErroPagamento('Não foi possível ativar o plano. Verifique sua conexão.');
      }
    } finally {
      setProcessandoPagamento(false);
      setSalvandoId(null);
    }
  }

  async function handleCancelar() {
    if (salvandoId) return;
    setSalvandoId('cancelar');
    setMensagem('');
    setMensagemErro(false);
    esconderConfirmacao();
    try {
      const ok = await cancelarAssinatura();
      if (ok) {
        setMensagem('Sua assinatura foi cancelada.');
        setConfirmandoCancelamento(false);
      } else {
        setMensagem('Não foi possível cancelar a assinatura.');
        setMensagemErro(true);
      }
    } finally {
      setSalvandoId(null);
    }
  }

  const valorCheckout = planoEmCheckout
    ? ciclo === 'anual'
      ? `R$ ${planoEmCheckout.precoAnual}/mês (Total anual: R$ ${planoEmCheckout.totalAnual})`
      : `R$ ${planoEmCheckout.preco}/mês`
    : '';
  const codigoPixDemo = `00020126580014BR.GOV.BCB.PIX0136homewise-tcc-${planoEmCheckout?.id || 'plus'}-${ciclo}5204000053039865802BR5916HOMEWISEMONITORA6009SAOPAULO62070503***6304A1B2`;

  return (
    <SubscriptionScreen title="Gerenciar assinatura" onBack={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))}>
      <Text style={s.eyebrow}>PLANOS HOMEWISE</Text>
      <Text style={s.title}>O plano certo para sua casa.</Text>
      <Text style={s.subtitle}>Planos flexíveis e sem fidelidade. Economize mais, pague menos.</Text>

      <View style={styles.current}>
        <View style={s.icon}>
          <Ionicons name={planoSalvo ? planoSalvo.icone : 'layers-outline'} size={22} color="#22b7d4" />
        </View>
        <View style={styles.currentText}>
          <Text style={styles.currentLabel}>SUA ASSINATURA ATUAL</Text>
          <Text style={styles.currentName}>
            {planoSalvo
              ? `HomeWise ${planoSalvo.nome} (${perfil?.ciclo_assinatura === 'anual' ? 'Anual' : 'Mensal'})`
              : 'Sem plano contratado'}
          </Text>
        </View>
        {planoSalvo && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancelar assinatura"
            accessibilityState={{ disabled: !!salvandoId, expanded: confirmandoCancelamento }}
            disabled={!!salvandoId}
            style={styles.cancelPill}
            onPress={() => { setMensagem(''); setConfirmandoCancelamento(true); }}
          >
            <Text style={styles.cancelPillText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      {planoSalvo && confirmandoCancelamento && (
        <View style={styles.confirmarCancelamento} accessibilityLiveRegion="polite">
          <Text style={styles.confirmarCancelamentoTitulo} accessibilityRole="header">Cancelar assinatura?</Text>
          <Text style={styles.confirmarCancelamentoTexto}>
            Ao cancelar, recursos exclusivos como metas mensais e relatórios anuais voltarão a ficar restritos. Você pode reativar quando quiser.
          </Text>
          {mensagemErro && !!mensagem && (
            <Text accessibilityRole="alert" style={styles.confirmarCancelamentoErro}>{mensagem}</Text>
          )}
          <View style={styles.confirmarCancelamentoAcoes}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={salvandoId === 'cancelar'}
              style={styles.manterPlano}
              onPress={() => { setConfirmandoCancelamento(false); setMensagem(''); setMensagemErro(false); }}
            >
              <Text style={styles.manterPlanoTexto}>Manter plano</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !!salvandoId, busy: salvandoId === 'cancelar' }}
              disabled={!!salvandoId}
              style={[styles.confirmarCancelamentoBotao, !!salvandoId && { opacity: 0.7 }]}
              onPress={() => void handleCancelar()}
            >
              {salvandoId === 'cancelar'
                ? <ActivityIndicator color="#fca5a5" size="small" />
                : <Text style={styles.confirmarCancelamentoBotaoTexto}>Confirmar cancelamento</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!confirmacao && (
        <View
          style={styles.confirmacao}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Pagamento aprovado, simulação. ${confirmacao} Checkout demonstrativo, nenhuma cobrança real foi feita.`}
        >
          <View style={styles.confirmacaoIcone}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.confirmacaoTopo}>
              <Text style={styles.confirmacaoTitulo}>Pagamento aprovado</Text>
              <View style={styles.seloSimulacao}>
                <Text style={styles.seloSimulacaoTexto}>SIMULAÇÃO</Text>
              </View>
            </View>
            <Text style={styles.feedbackText}>{confirmacao}</Text>
            <Text style={styles.confirmacaoNota}>Checkout demonstrativo: nenhuma cobrança real foi feita.</Text>
          </View>
        </View>
      )}

      {!!mensagem && !(mensagemErro && confirmandoCancelamento) && (
        <View
          style={[styles.feedbackBanner, mensagemErro && styles.feedbackErro]}
          accessibilityRole={mensagemErro ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name={mensagemErro ? 'alert-circle' : 'checkmark-circle'} size={18} color={mensagemErro ? '#f87171' : '#22b7d4'} />
          <Text style={styles.feedbackText}>{mensagem}</Text>
        </View>
      )}

      {/* Alternador Mensal / Anual */}
      <View style={styles.cycleToggle}>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: ciclo === 'mensal' }}
          style={[styles.cycleTab, ciclo === 'mensal' && styles.cycleTabActive]}
          onPress={() => setCiclo('mensal')}
        >
          <Text style={[styles.cycleTabText, ciclo === 'mensal' && styles.cycleTabTextActive]}>Mensal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: ciclo === 'anual' }}
          style={[styles.cycleTab, ciclo === 'anual' && styles.cycleTabActive]}
          onPress={() => setCiclo('anual')}
        >
          <Text style={[styles.cycleTabText, ciclo === 'anual' && styles.cycleTabTextActive]}>Anual</Text>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-15% OFF</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {planos.map(plano => {
          const ehPlanoAtual = planoSalvo?.id === plano.id && (perfil?.ciclo_assinatura || 'mensal') === ciclo;
          const carregandoEste = salvandoId === plano.id;
          return (
            <View key={plano.id} style={[s.card, (plano.id === 'plus' || ehPlanoAtual) && s.featured]}>
              <View style={s.cardTop}>
                <View style={s.icon}>
                  <Ionicons name={plano.icone} size={24} color="#22b7d4" />
                </View>
                {ehPlanoAtual ? (
                  <View style={[s.badge, styles.activeBadge]}>
                    <Text style={[s.badgeText, { color: '#4ade80' }]}>PLANO ATIVO</Text>
                  </View>
                ) : (
                  plano.id === 'plus' && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>MAIS ESCOLHIDO</Text>
                    </View>
                  )
                )}
              </View>
              <Text style={s.planName}>{plano.nome}</Text>
              <Text style={s.description}>{plano.descricao}</Text>
              <PlanPrice
                value={ciclo === 'anual' ? plano.precoAnual : plano.preco}
                annualTotal={plano.totalAnual}
                isAnnual={ciclo === 'anual'}
              />
              <View style={s.divider} />
              <PlanBenefits items={plano.beneficios} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Escolher plano ${plano.nome}`}
                disabled={ehPlanoAtual || !!salvandoId}
                style={[
                  plano.id === 'plus' && !ehPlanoAtual ? s.primary : s.secondary,
                  ehPlanoAtual && styles.currentButton,
                ]}
                onPress={() => abrirCheckout(plano)}
              >
                {carregandoEste ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={plano.id === 'plus' && !ehPlanoAtual ? s.primaryText : s.secondaryText}>
                    {ehPlanoAtual ? 'Plano atual ativo' : `Escolher ${plano.nome}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <View style={s.note}>
        <Ionicons name="information-circle-outline" size={18} color="#7f97a6" />
        <Text style={s.noteText}>
          O plano escolhido é salvo na nuvem na sua conta HomeWise e sincronizado entre o site e o aplicativo. Ambiente acadêmico sem cobrança real.
        </Text>
      </View>

      {/* Modal de Checkout / Simulação de Pagamento */}
      <Modal
        visible={planoEmCheckout !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processandoPagamento) setPlanoEmCheckout(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalBox} accessibilityViewIsModal>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>CHECKOUT DEMONSTRATIVO</Text>
                  <Text style={styles.modalTitle}>
                    Assinar HomeWise {planoEmCheckout?.nome}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Fechar pagamento"
                  disabled={processandoPagamento}
                  onPress={() => setPlanoEmCheckout(null)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color="#9db1bd" />
                </TouchableOpacity>
              </View>

              <View style={styles.summaryBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.summaryPlan}>
                    Plano {planoEmCheckout?.nome} • Ciclo {ciclo === 'anual' ? 'Anual (-15%)' : 'Mensal'}
                  </Text>
                  <Ionicons name="shield-checkmark" size={16} color="#22b7d4" />
                </View>
                <Text style={styles.summaryValue}>{valorCheckout}</Text>
              </View>

              {/* Abas de Método de Pagamento */}
              <Text style={styles.fieldLabel}>Escolha a forma de pagamento</Text>
              <View style={styles.payTabs}>
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: metodo === 'pix' }}
                  style={[styles.payTab, metodo === 'pix' && styles.payTabActive]}
                  onPress={() => {
                    setMetodo('pix');
                    setErroPagamento('');
                  }}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={16}
                    color={metodo === 'pix' ? '#ffffff' : '#7f97a6'}
                  />
                  <Text style={[styles.payTabText, metodo === 'pix' && styles.payTabTextActive]}>
                    PIX Instantâneo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: metodo === 'cartao' }}
                  style={[styles.payTab, metodo === 'cartao' && styles.payTabActive]}
                  onPress={() => {
                    setMetodo('cartao');
                    setErroPagamento('');
                  }}
                >
                  <Ionicons
                    name="card-outline"
                    size={16}
                    color={metodo === 'cartao' ? '#ffffff' : '#7f97a6'}
                  />
                  <Text style={[styles.payTabText, metodo === 'cartao' && styles.payTabTextActive]}>
                    Cartão de Crédito
                  </Text>
                </TouchableOpacity>
              </View>

              {metodo === 'pix' ? (
                <View style={styles.pixContainer}>
                  <View style={styles.qrCodeFrame}>
                    <Svg width={132} height={132} viewBox="0 0 120 120">
                      <Rect x="0" y="0" width="120" height="120" rx="8" fill="#ffffff" />
                      <Path
                        fill="#07131b"
                        d="M12,12 h30 v30 h-30 z M18,18 v18 h18 v-18 z M22,22 h10 v10 h-10 z M78,12 h30 v30 h-30 z M84,18 v18 h18 v-18 z M88,22 h10 v10 h-10 z M12,78 h30 v30 h-30 z M18,84 v18 h18 v-18 z M22,88 h10 v10 h-10 z M50,12 h8 v8 h-8 z M62,12 h8 v16 h-8 z M50,28 h8 v14 h-8 z M12,50 h14 v8 h-14 z M34,50 h16 v8 h-16 z M58,46 h14 v14 h-14 z M78,50 h12 v8 h-12 z M98,50 h10 v16 h-10 z M50,68 h10 v12 h-10 z M68,68 h16 v8 h-16 z M50,88 h16 v8 h-16 z M74,84 h14 v14 h-14 z M94,78 h14 v12 h-14 z M74,100 h34 v8 h-34 z"
                      />
                    </Svg>
                  </View>
                  <Text style={styles.pixHint}>
                    Escaneie o QR Code demonstrativo ou copie a chave PIX Copia e Cola abaixo:
                  </Text>
                  <View style={styles.pixCodeBox}>
                    <Text style={styles.pixCodeText} numberOfLines={2}>
                      {codigoPixDemo}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.copyPixBtn}
                    onPress={() => setPixCopiado(true)}
                  >
                    <Ionicons
                      name={pixCopiado ? 'checkmark-circle' : 'copy-outline'}
                      size={16}
                      color="#22b7d4"
                    />
                    <Text style={styles.copyPixText}>
                      {pixCopiado ? 'Código PIX copiado!' : 'Copiar código PIX'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cardForm}>
                  <View>
                    <Text style={styles.fieldLabel}>Número do cartão (fictício)</Text>
                    <TextInput
                      style={styles.input}
                      value={numCartao}
                      onChangeText={formatarCartao}
                      keyboardType="numeric"
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor="#7f97a6"
                      maxLength={19}
                    />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Nome impresso no cartão</Text>
                    <TextInput
                      style={styles.input}
                      value={nomeCartao}
                      onChangeText={setNomeCartao}
                      placeholder="NOME COMPLETO"
                      placeholderTextColor="#7f97a6"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Validade</Text>
                      <TextInput
                        style={styles.input}
                        value={validadeCartao}
                        onChangeText={formatarValidade}
                        keyboardType="numeric"
                        placeholder="MM/AA"
                        placeholderTextColor="#7f97a6"
                        maxLength={5}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>CVV</Text>
                      <TextInput
                        style={styles.input}
                        value={cvvCartao}
                        onChangeText={t => setCvvCartao(t.replace(/\D/g, '').slice(0, 4))}
                        keyboardType="numeric"
                        placeholder="123"
                        placeholderTextColor="#7f97a6"
                        maxLength={4}
                        secureTextEntry
                      />
                    </View>
                  </View>
                </View>
              )}

              {!!erroPagamento && (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {erroPagamento}
                </Text>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                disabled={processandoPagamento}
                style={[s.primary, { marginTop: 16 }, processandoPagamento && { opacity: 0.7 }]}
                onPress={() => void confirmarPagamentoSimulado()}
              >
                {processandoPagamento ? (
                  <>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={s.primaryText}>Processando pagamento…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={19} color="#ffffff" />
                    <Text style={s.primaryText}>
                      {metodo === 'pix' ? 'Simular pagamento PIX e ativar' : 'Pagar com cartão e ativar'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.demoDisclaimer}>
                Simulação acadêmica (TCC): nenhum valor real será cobrado.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SubscriptionScreen>
  );
}

const styles = StyleSheet.create({
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#0b1c27',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#173244',
    padding: 16,
    marginBottom: 16,
  },
  currentText: { flex: 1 },
  currentLabel: { fontSize: 10.5, color: '#7f97a6', fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  currentName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cancelPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#261414',
  },
  cancelPillText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackErro: { backgroundColor: '#261414', borderColor: '#7f1d1d' },
  confirmarCancelamento: {
    backgroundColor: '#1a1214',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  confirmarCancelamentoTitulo: { color: '#f1f7fa', fontSize: 16, fontWeight: '800' },
  confirmarCancelamentoTexto: { color: '#9db1bd', fontSize: 13, lineHeight: 19 },
  confirmarCancelamentoErro: { color: '#fca5a5', fontSize: 13, lineHeight: 19 },
  confirmarCancelamentoAcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  manterPlano: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#21465c',
    backgroundColor: '#0f2431',
    justifyContent: 'center',
  },
  manterPlanoTexto: { color: '#22b7d4', fontSize: 13, fontWeight: '700' },
  confirmarCancelamentoBotao: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#3b181c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmarCancelamentoBotaoTexto: { color: '#fca5a5', fontSize: 13, fontWeight: '700' },
  confirmacao: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  confirmacaoIcone: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmacaoTopo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  confirmacaoTitulo: { color: '#f1f7fa', fontSize: 15, fontWeight: '800' },
  seloSimulacao: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  seloSimulacaoTexto: { color: '#fbbf24', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  confirmacaoNota: { color: '#9db1bd', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f2431',
    borderWidth: 1,
    borderColor: '#0a7d96',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  feedbackText: {
    color: '#e2e8f0',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  cycleToggle: {
    flexDirection: 'row',
    backgroundColor: '#0b1c27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#122a39',
    gap: 4,
    padding: 4,
    marginBottom: 20,
  },
  cycleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
  },
  cycleTabActive: {
    backgroundColor: 'rgba(34, 183, 212, 0.16)',
    borderColor: 'rgba(34, 183, 212, 0.5)',
  },
  cycleTabText: {
    color: '#7f97a6',
    fontSize: 13,
    fontWeight: '600',
  },
  cycleTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  discountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  activeBadge: {
    borderColor: '#22c55e88',
    backgroundColor: '#14532d66',
  },
  currentButton: {
    opacity: 0.65,
    borderColor: '#21465c',
  },
  list: { gap: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: '#0b1c27',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#173244',
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalEyebrow: {
    color: '#22b7d4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0b1c27',
    borderWidth: 1,
    borderColor: '#173244',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBox: {
    backgroundColor: '#0f2431',
    borderWidth: 1,
    borderColor: '#21465c',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  summaryPlan: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  fieldLabel: {
    color: '#9db1bd',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  payTabs: {
    flexDirection: 'row',
    backgroundColor: '#0b1c27',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  payTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  payTabActive: {
    backgroundColor: '#0a7d96',
  },
  payTabText: {
    color: '#7f97a6',
    fontSize: 13,
    fontWeight: '600',
  },
  payTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pixContainer: {
    alignItems: 'center',
    backgroundColor: '#07131b',
    borderWidth: 1,
    borderColor: '#122a39',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  qrCodeFrame: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  pixHint: {
    color: '#9db1bd',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  pixCodeBox: {
    width: '100%',
    backgroundColor: '#0b1c27',
    borderWidth: 1,
    borderColor: '#173244',
    borderRadius: 10,
    padding: 10,
  },
  pixCodeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyPixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#0f2431',
    borderWidth: 1,
    borderColor: '#21465c',
  },
  copyPixText: {
    color: '#22b7d4',
    fontSize: 12,
    fontWeight: '600',
  },
  cardForm: {
    gap: 12,
  },
  input: {
    backgroundColor: '#07131b',
    borderWidth: 1,
    borderColor: '#173244',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    color: '#ffffff',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 10,
  },
  demoDisclaimer: {
    color: '#7f97a6',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});
