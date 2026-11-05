import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (perfil?.ciclo_assinatura === 'anual' || perfil?.ciclo_assinatura === 'mensal') {
      setCiclo(perfil.ciclo_assinatura);
    }
  }, [perfil?.ciclo_assinatura]);

  useEffect(() => {
    if (params.checkout) {
      const p = obterPlanoPorId(params.checkout);
      if (p) abrirCheckout(p);
    }
  }, [params.checkout]);

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
        setMensagem(
          `Pagamento via ${metodoLabel} aprovado! Plano HomeWise ${planoEmCheckout.nome} (${ciclo}) ativado com sucesso.`
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
    try {
      const ok = await cancelarAssinatura();
      if (ok) {
        setMensagem('Sua assinatura foi cancelada.');
      } else {
        setMensagem('Não foi possível cancelar a assinatura.');
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
    <SubscriptionScreen title="Gerenciar assinatura" onBack={() => router.replace('/plano-assinatura')}>
      <Text style={s.eyebrow}>PLANOS HOMEWISE</Text>
      <Text style={s.title}>O plano certo para sua casa.</Text>
      <Text style={s.subtitle}>Planos flexíveis e sem fidelidade. Economize mais, pague menos.</Text>

      <View style={styles.current}>
        <View style={s.icon}>
          <Ionicons name={planoSalvo ? planoSalvo.icone : 'layers-outline'} size={22} color="#38bdf8" />
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
            disabled={!!salvandoId}
            style={styles.cancelPill}
            onPress={() => void handleCancelar()}
          >
            <Text style={styles.cancelPillText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!mensagem && (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#38bdf8" />
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
                  <Ionicons name={plano.icone} size={24} color="#38bdf8" />
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
        <Ionicons name="information-circle-outline" size={18} color="#64748b" />
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
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.summaryBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.summaryPlan}>
                    Plano {planoEmCheckout?.nome} • Ciclo {ciclo === 'anual' ? 'Anual (-15%)' : 'Mensal'}
                  </Text>
                  <Ionicons name="shield-checkmark" size={16} color="#38bdf8" />
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
                    color={metodo === 'pix' ? '#ffffff' : '#64748b'}
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
                    color={metodo === 'cartao' ? '#ffffff' : '#64748b'}
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
                      color="#38bdf8"
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
                      placeholderTextColor="#64748b"
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
                      placeholderTextColor="#64748b"
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
                        placeholderTextColor="#64748b"
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
                        placeholderTextColor="#64748b"
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
    backgroundColor: '#0b1d28',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    padding: 16,
    marginBottom: 16,
  },
  currentText: { flex: 1 },
  currentLabel: { fontSize: 9, color: '#64748b', fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  currentName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cancelPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#261414',
  },
  cancelPillText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0c2738',
    borderWidth: 1,
    borderColor: '#0284c7',
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
    backgroundColor: '#0a1a24',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  cycleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  cycleTabActive: {
    backgroundColor: '#0284c7',
  },
  cycleTabText: {
    color: '#64748b',
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
    borderColor: '#164e63',
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
    backgroundColor: '#0b1d28',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalEyebrow: {
    color: '#38bdf8',
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
    backgroundColor: '#0e222e',
    borderWidth: 1,
    borderColor: '#1e3a4b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBox: {
    backgroundColor: '#0c2738',
    borderWidth: 1,
    borderColor: '#164e63',
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
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  payTabs: {
    flexDirection: 'row',
    backgroundColor: '#0a1a24',
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
    backgroundColor: '#0284c7',
  },
  payTabText: {
    color: '#64748b',
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
    borderColor: '#132838',
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
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  pixCodeBox: {
    width: '100%',
    backgroundColor: '#0b1d28',
    borderWidth: 1,
    borderColor: '#1e3a4b',
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
    backgroundColor: '#0f2b3c',
    borderWidth: 1,
    borderColor: '#164e63',
  },
  copyPixText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  cardForm: {
    gap: 12,
  },
  input: {
    backgroundColor: '#07131b',
    borderWidth: 1,
    borderColor: '#1e3a4b',
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
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});
