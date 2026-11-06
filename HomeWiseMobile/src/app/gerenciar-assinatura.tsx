import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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

function validarCPF(cpf: string): boolean {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11 || /^(\d)\1{10}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(limpo.charAt(10), 10);
}

/** Texto da confirmação, a partir do plano e ciclo efetivamente gravados. */
export function textoConfirmacaoContratacao(nomePlano: string, ciclo: CicloAssinatura) {
  return `Simulação concluída: plano HomeWise ${nomePlano} ${ciclo === 'anual' ? 'anual' : 'mensal'} ativado.`;
}

export default function GerenciarAssinaturaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const { user, perfil, atualizarPlanoAssinatura, cancelarAssinatura, assinaturaPendente,
    assinaturaEstado, assinaturaMensagem, assinaturaEscritaLiberada, reconciliarAssinatura } = useAuth();
  const assinaturaIndefinida = assinaturaEstado === 'inconsistente' || assinaturaEstado === 'consultando';
  const escritaBloqueada = !assinaturaEscritaLiberada || assinaturaIndefinida || assinaturaPendente;
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const ativo = temPlanoAtivo(perfil?.plano, perfil?.status_assinatura);
  const planoSalvo = ativo ? obterPlanoPorId(perfil?.plano) : null;
  const cicloAtual: CicloAssinatura = perfil?.ciclo_assinatura === 'anual' ? 'anual' : 'mensal';

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

  // Dados cadastrais e de endereço de cobrança da assinatura
  const [nomeAssinante, setNomeAssinante] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [statusCep, setStatusCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Dados do cartão de crédito
  const [numCartao, setNumCartao] = useState('');
  const [nomeCartao, setNomeCartao] = useState('');
  const [validadeCartao, setValidadeCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [erroPagamento, setErroPagamento] = useState('');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const emEnvio = useRef(false);
  const prazoEspera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirmação temporária do pagamento simulado: fica só em memória, some após 5 s
  // e não reaparece ao reabrir ou recarregar a tela.
  const [confirmacao, setConfirmacao] = useState('');
  const [estadoDaConfirmacao, setEstadoDaConfirmacao] = useState(assinaturaEstado);
  if (estadoDaConfirmacao !== assinaturaEstado) {
    setEstadoDaConfirmacao(assinaturaEstado);
    if (assinaturaIndefinida && confirmacao) setConfirmacao('');
  }
  const temporizadorConfirmacao = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      if (temporizadorConfirmacao.current) clearTimeout(temporizadorConfirmacao.current);
      temporizadorConfirmacao.current = null;
      if (prazoEspera.current) clearTimeout(prazoEspera.current);
    };
  }, []);

  function mostrarConfirmacao(texto: string) {
    // O pagamento pode terminar depois que a pessoa saiu da tela: nesse caso não cria temporizador
    if (!montada.current) return;
    if (temporizadorConfirmacao.current) clearTimeout(temporizadorConfirmacao.current);
    setConfirmacao(texto);
    // Web: role="alert" anuncia. iOS não anuncia regiões vivas; Android anuncia, e o anúncio explícito
    // garante a leitura mesmo com o foco ainda saindo do checkout.
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(`${texto} Nenhuma cobrança real foi feita.`);
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
    if (!assinaturaEscritaLiberada || assinaturaIndefinida || assinaturaPendente || processandoPagamento) return;
    setErroPagamento('');
    setPixCopiado(false);
    setStatusCep('');

    const nomePadrao = perfil?.nome || user?.displayName || '';
    if (!nomeAssinante && nomePadrao) setNomeAssinante(nomePadrao);
    if (!cpf && perfil?.cpf) setCpf(perfil.cpf);
    if (!telefone && perfil?.telefone) setTelefone(perfil.telefone);
    if (!cep && perfil?.cep) setCep(perfil.cep);
    if (!rua && perfil?.endereco_detalhado?.rua) setRua(perfil.endereco_detalhado.rua);
    if (!numero && perfil?.endereco_detalhado?.numero) setNumero(perfil.endereco_detalhado.numero);
    if (!complemento && perfil?.endereco_detalhado?.complemento) setComplemento(perfil.endereco_detalhado.complemento);
    if (!bairro && perfil?.endereco_detalhado?.bairro) setBairro(perfil.endereco_detalhado.bairro);
    if (!cidade && perfil?.endereco_detalhado?.cidade) setCidade(perfil.endereco_detalhado.cidade);
    if (!estado && perfil?.endereco_detalhado?.estado) setEstado(perfil.endereco_detalhado.estado);

    if (!nomeCartao && nomePadrao) {
      setNomeCartao(nomePadrao.toUpperCase());
    }
    setPlanoEmCheckout(plano);
  }

  function formatarCpf(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 11);
    const formatado = digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(formatado);
  }

  function formatarTelefone(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 11);
    let formatado = digitos;
    if (digitos.length > 2) {
      formatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
    }
    if (digitos.length > 7) {
      formatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    }
    setTelefone(formatado);
  }

  async function formatarCep(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 8);
    const formatado = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    setCep(formatado);

    if (digitos.length === 8) {
      setStatusCep('Buscando CEP…');
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
        const dados = await resp.json();
        if (!dados.erro) {
          if (dados.logradouro) setRua(dados.logradouro);
          if (dados.bairro) setBairro(dados.bairro);
          if (dados.localidade) setCidade(dados.localidade);
          if (dados.uf) setEstado(dados.uf);
          setStatusCep('Endereço preenchido');
        } else {
          setStatusCep('CEP não encontrado');
        }
      } catch {
        setStatusCep('');
      }
    } else {
      setStatusCep('');
    }
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
    if (!assinaturaEscritaLiberada || assinaturaIndefinida || !planoEmCheckout || emEnvio.current || assinaturaPendente) return;
    setErroPagamento('');

    if (nomeAssinante.trim().length < 3) {
      setErroPagamento('Informe o nome completo do titular da assinatura.');
      return;
    }
    if (!validarCPF(cpf)) {
      setErroPagamento('Informe um CPF válido (11 dígitos).');
      return;
    }
    if (telefone.replace(/\D/g, '').length < 10) {
      setErroPagamento('Informe um telefone/celular com DDD válido.');
      return;
    }
    if (cep.replace(/\D/g, '').length !== 8) {
      setErroPagamento('Informe um CEP válido de 8 dígitos.');
      return;
    }
    if (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || estado.trim().length !== 2) {
      setErroPagamento('Preencha o endereço completo (Rua, Número, Bairro, Cidade e UF).');
      return;
    }

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

    const enderecoFormatado = `${rua.trim()}, ${numero.trim()}${
      complemento.trim() ? ` - ${complemento.trim()}` : ''
    }, ${bairro.trim()} - ${cidade.trim()}/${estado.trim().toUpperCase()} (CEP: ${cep.trim()})`;

    // Plano e ciclo desta tentativa: a confirmação usa exatamente o que foi enviado e gravado.
    const planoEscolhido = planoEmCheckout;
    const cicloEscolhido = ciclo;
    emEnvio.current = true;
    setDemorando(false);
    prazoEspera.current = setTimeout(() => {
      if (montada.current) setDemorando(true);
    }, 10000);
    setProcessandoPagamento(true);
    setSalvandoId(planoEscolhido.id);
    // O try cobre só a gravação: um erro na interface depois do sucesso nunca vira "não concluída".
    let ok = false;
    try {
      // Simula tempo de aprovação da transação
      await new Promise(resolve => setTimeout(resolve, 900));
      ok = (await atualizarPlanoAssinatura(planoEscolhido.id, cicloEscolhido, {
        nome: nomeAssinante.trim(),
        cpf: cpf.trim(),
        telefone: telefone.trim(),
        cep: cep.trim(),
        residencia: enderecoFormatado,
        endereco_detalhado: {
          rua: rua.trim(),
          numero: numero.trim(),
          complemento: complemento.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          estado: estado.trim().toUpperCase(),
        },
        metodo_pagamento: metodo,
      })) === true;
    } catch {
      ok = false;
    } finally {
      emEnvio.current = false;
      if (prazoEspera.current) clearTimeout(prazoEspera.current);
      prazoEspera.current = null;
      if (montada.current) {
        setDemorando(false);
        setProcessandoPagamento(false);
        setSalvandoId(null);
      }
    }
    if (!montada.current) return;
    if (!ok) {
      // Checkout continua aberto, com a falha; nada indica contratação concluída.
      setErroPagamento('Não foi possível confirmar a ativação. Confira o estado da assinatura antes de tentar novamente.');
      return;
    }
    setMensagem('');
    setMensagemErro(false);
    setConfirmandoCancelamento(false);
    setPlanoEmCheckout(null);
    mostrarConfirmacao(textoConfirmacaoContratacao(planoEscolhido.nome, cicloEscolhido));
    rolagem.current?.scrollTo({ y: 0, animated: true });
    // Por último: recarregar não deve reabrir o checkout de um plano já contratado.
    if (params.checkout) router.setParams?.({ checkout: undefined });
  }

  async function handleCancelar() {
    if (escritaBloqueada || salvandoId) return;
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
    <SubscriptionScreen scrollRef={rolagem} title="Gerenciar assinatura" onBack={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))}>
      {!assinaturaEscritaLiberada && <Text accessibilityRole="alert" style={s.subtitle}>Alterações de assinatura bloqueadas: a política implantada ainda não foi homologada. A simulação está disponível somente na revisão local com mocks.</Text>}
      {!!assinaturaMensagem && <Text accessibilityRole="alert" style={s.subtitle}>{assinaturaMensagem}</Text>}
      {assinaturaIndefinida && <TouchableOpacity accessibilityRole="button" disabled={assinaturaEstado === 'consultando'} onPress={() => void reconciliarAssinatura()}><Text style={s.subtitle}>Consultar assinatura no servidor</Text></TouchableOpacity>}
      {assinaturaPendente && <Text accessibilityRole="alert" style={s.subtitle}>Ativação ou alteração pendente de confirmação. Não reenvie: a operação pode terminar ao reconectar.</Text>}
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
            {assinaturaIndefinida ? 'Assinatura em verificação' : planoSalvo
              ? `HomeWise ${planoSalvo.nome} (${cicloAtual === 'anual' ? 'Anual' : 'Mensal'})`
              : 'Sem plano contratado'}
          </Text>
        </View>
        {planoSalvo && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancelar assinatura"
            accessibilityState={{ disabled: !!salvandoId, expanded: confirmandoCancelamento }}
            disabled={!!salvandoId || escritaBloqueada}
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
              disabled={!!salvandoId || escritaBloqueada}
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

      {!!confirmacao && !assinaturaIndefinida && (
        <View
          style={styles.confirmacao}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${confirmacao} Checkout demonstrativo, nenhuma cobrança real foi feita.`}
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
          const ehPlanoAtual = planoSalvo?.id === plano.id && cicloAtual === ciclo;
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
                disabled={ehPlanoAtual || !!salvandoId || escritaBloqueada}
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
          if (!processandoPagamento || demorando) setPlanoEmCheckout(null);
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
                  disabled={processandoPagamento && !demorando}
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

              {/* Seção 1: Dados do Assinante */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="person-outline" size={15} color="#22b7d4" />
                  <Text style={styles.sectionTitle}>Dados do assinante</Text>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Nome completo *</Text>
                  <TextInput
                    style={styles.input}
                    value={nomeAssinante}
                    onChangeText={setNomeAssinante}
                    placeholder="Seu nome completo"
                    placeholderTextColor="#7f97a6"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CPF *</Text>
                    <TextInput
                      style={styles.input}
                      value={cpf}
                      onChangeText={formatarCpf}
                      keyboardType="numeric"
                      placeholder="000.000.000-00"
                      placeholderTextColor="#7f97a6"
                      maxLength={14}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Telefone / Celular *</Text>
                    <TextInput
                      style={styles.input}
                      value={telefone}
                      onChangeText={formatarTelefone}
                      keyboardType="phone-pad"
                      placeholder="(00) 00000-0000"
                      placeholderTextColor="#7f97a6"
                      maxLength={15}
                    />
                  </View>
                </View>
              </View>

              {/* Seção 2: Endereço da Residência e Cobrança */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="location-outline" size={15} color="#22b7d4" />
                  <Text style={styles.sectionTitle}>Endereço de cobrança / residência</Text>
                </View>

                <View>
                  <View style={styles.cepHeaderRow}>
                    <Text style={styles.fieldLabel}>CEP *</Text>
                    {!!statusCep && (
                      <Text style={styles.cepStatusText}>{statusCep}</Text>
                    )}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={cep}
                    onChangeText={t => void formatarCep(t)}
                    keyboardType="numeric"
                    placeholder="00000-000"
                    placeholderTextColor="#7f97a6"
                    maxLength={9}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Rua / Avenida *</Text>
                  <TextInput
                    style={styles.input}
                    value={rua}
                    onChangeText={setRua}
                    placeholder="Nome da rua ou avenida"
                    placeholderTextColor="#7f97a6"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Número *</Text>
                    <TextInput
                      style={styles.input}
                      value={numero}
                      onChangeText={setNumero}
                      placeholder="123"
                      placeholderTextColor="#7f97a6"
                    />
                  </View>
                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.fieldLabel}>Complemento</Text>
                    <TextInput
                      style={styles.input}
                      value={complemento}
                      onChangeText={setComplemento}
                      placeholder="Apto, Bloco (opcional)"
                      placeholderTextColor="#7f97a6"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.fieldLabel}>Bairro *</Text>
                    <TextInput
                      style={styles.input}
                      value={bairro}
                      onChangeText={setBairro}
                      placeholder="Seu bairro"
                      placeholderTextColor="#7f97a6"
                    />
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.fieldLabel}>Cidade *</Text>
                    <TextInput
                      style={styles.input}
                      value={cidade}
                      onChangeText={setCidade}
                      placeholder="Cidade"
                      placeholderTextColor="#7f97a6"
                    />
                  </View>
                  <View style={{ width: 64 }}>
                    <Text style={styles.fieldLabel}>UF *</Text>
                    <TextInput
                      style={[styles.input, { textAlign: 'center' }]}
                      value={estado}
                      onChangeText={t => setEstado(t.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
                      placeholder="SP"
                      placeholderTextColor="#7f97a6"
                      autoCapitalize="characters"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>

              {/* Seção 3: Abas de Método de Pagamento */}
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="wallet-outline" size={15} color="#22b7d4" />
                <Text style={styles.sectionTitle}>Forma de pagamento</Text>
              </View>
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

              {demorando && <Text accessibilityRole="alert" style={s.subtitle}>Ainda aguardando confirmação. Sem conexão, a gravação permanece pendente. Este prazo não cancela a operação; você pode fechar e acompanhar o estado sem reenviar.</Text>}
              {!!erroPagamento && (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {erroPagamento}
                </Text>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                disabled={processandoPagamento || assinaturaPendente || !assinaturaEscritaLiberada || assinaturaIndefinida}
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
  sectionBlock: {
    backgroundColor: '#07131b',
    borderWidth: 1,
    borderColor: '#122a39',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cepStatusText: {
    color: '#22b7d4',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
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
