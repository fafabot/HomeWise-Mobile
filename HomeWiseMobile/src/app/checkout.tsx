import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { planos } from '@/constants/planos';
import { PlanBenefits, PlanPrice, SubscriptionScreen, subscriptionStyles as s } from '@/components/SubscriptionUI';
import { useAuth } from '@/contexts/AuthContext';
import { consultarPlanoAtivo, type PlanoAtivo } from '@/services/assinaturaService';

const formasPagamento = [
  { id: 'pix', titulo: 'Pix', detalhe: 'Pagamento instantâneo', icone: 'qr-code-outline' as const },
  { id: 'cartao', titulo: 'Cartão de crédito', detalhe: 'Consulte as condições no pagamento', icone: 'card-outline' as const },
  { id: 'boleto', titulo: 'Boleto bancário', detalhe: 'Compensação em até 3 dias úteis', icone: 'barcode-outline' as const },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { plano: planoId } = useLocalSearchParams<{ plano?: string }>();
  const plano = planos.find(item => item.id === planoId);
  const [consultandoPlano, setConsultandoPlano] = useState(true);
  const [planoAtivo, setPlanoAtivo] = useState<PlanoAtivo | null>(null);
  const [erroConsulta, setErroConsulta] = useState('');
  const [tentativasConsulta, setTentativasConsulta] = useState(0);
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepEncontrado, setCepEncontrado] = useState(false);
  const [erroBuscaCep, setErroBuscaCep] = useState('');
  const [formaSelecionada, setFormaSelecionada] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelada = false;
    setConsultandoPlano(true);
    setPlanoAtivo(null);
    setErroConsulta('');

    if (!user?.uid) {
      setErroConsulta('Não foi possível identificar sua conta. Entre novamente e tente de novo.');
      setConsultandoPlano(false);
      return () => { cancelada = true; };
    }

    consultarPlanoAtivo(user.uid)
      .then(resultado => {
        if (!cancelada) setPlanoAtivo(resultado);
      })
      .catch(error => {
        console.warn('[Assinatura] Erro ao consultar plano atual:', error);
        if (!cancelada) setErroConsulta('Não foi possível verificar se sua conta já tem um plano. Tente novamente.');
      })
      .finally(() => {
        if (!cancelada) setConsultandoPlano(false);
      });

    return () => { cancelada = true; };
  }, [user?.uid, tentativasConsulta]);

  useEffect(() => {
    const cepNumerico = cep.replace(/\D/g, '');
    if (cepNumerico.length !== 8) {
      setBuscandoCep(false);
      setCepEncontrado(false);
      setErroBuscaCep('');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBuscandoCep(true);
      setErroBuscaCep('');
      setCepEncontrado(false);
      try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cepNumerico}/json/`, { signal: controller.signal });
        if (!resposta.ok) throw new Error(`CEP lookup failed (${resposta.status})`);
        const dados = await resposta.json() as {
          erro?: boolean;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };
        if (controller.signal.aborted) return;
        if (dados.erro) {
          setErroBuscaCep('CEP não encontrado. Confira os números e tente novamente.');
          return;
        }

        setRua(dados.logradouro || '');
        setBairro(dados.bairro || '');
        setCidade(dados.localidade || '');
        setEstado(dados.uf || '');
        setCepEncontrado(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('[Checkout] Erro ao consultar CEP:', error);
        setErroBuscaCep('Não foi possível consultar o CEP. Verifique sua conexão e tente novamente.');
      } finally {
        if (!controller.signal.aborted) setBuscandoCep(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cep]);

  function atualizarCampo(
    campo: 'rua' | 'bairro' | 'numero' | 'complemento' | 'cidade' | 'estado',
    valor: string
  ) {
    const setters = {
      rua: setRua,
      bairro: setBairro,
      numero: setNumero,
      complemento: setComplemento,
      cidade: setCidade,
      estado: setEstado
    };
    setters[campo](campo === 'estado' ? valor.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase() : valor);
    setErros(atual => ({ ...atual, [campo]: '' }));
  }

  function continuarCheckout() {
    const novosErros: Record<string, string> = {};
    if (cep.replace(/\D/g, '').length !== 8) novosErros.cep = 'Informe um CEP válido com 8 números.';
    else if (!cepEncontrado) novosErros.cep = erroBuscaCep || 'Aguarde a consulta ou informe um CEP válido.';
    if (!rua.trim()) novosErros.rua = 'Informe a rua.';
    if (!numero.trim()) novosErros.numero = 'Informe o número.';
    if (!bairro.trim()) novosErros.bairro = 'Informe o bairro.';
    if (!cidade.trim()) novosErros.cidade = 'Informe a cidade.';
    if (!/^[A-Z]{2}$/.test(estado.trim())) novosErros.estado = 'Informe a UF com 2 letras.';
    if (!formaSelecionada) novosErros.pagamento = 'Escolha uma forma de pagamento.';

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || buscandoCep) return;

    Alert.alert(
      'Checkout demonstrativo',
      'Seus dados foram validados. O pagamento ainda não está conectado a um serviço e nenhuma cobrança ou contratação foi realizada.'
    );
  }

  if (consultandoPlano) {
    return (
      <SubscriptionScreen title="Verificando assinatura" onBack={() => router.replace('/gerenciar-assinatura')}>
        <View style={[s.card, styles.estadoConsulta]}>
          <ActivityIndicator color="#76d7cd" size="large" />
          <Text style={s.planName}>Verificando sua conta</Text>
          <Text style={s.description}>Só um instante enquanto consultamos se você já tem um plano ativo.</Text>
        </View>
      </SubscriptionScreen>
    );
  }

  if (erroConsulta) {
    return (
      <SubscriptionScreen title="Verificar assinatura" onBack={() => router.replace('/gerenciar-assinatura')}>
        <View style={s.card}>
          <Text style={s.planName}>Não foi possível continuar</Text>
          <Text style={s.description}>{erroConsulta}</Text>
          <TouchableOpacity accessibilityRole="button" style={[s.primary, styles.botaoVoltar]} onPress={() => setTentativasConsulta(valor => valor + 1)}>
            <Text style={s.primaryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SubscriptionScreen>
    );
  }

  if (planoAtivo) {
    return (
      <SubscriptionScreen title="Plano já ativo" onBack={() => router.replace('/gerenciar-assinatura')}>
        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={s.icon}><Ionicons name="checkmark-circle-outline" size={24} color="#76d7cd" /></View>
          </View>
          <Text style={s.planName}>Você já tem um plano</Text>
          <Text style={s.description}>Sua conta já possui o plano HomeWise {planoAtivo.nome} ativo. Não é necessário iniciar outro checkout.</Text>
          <TouchableOpacity accessibilityRole="button" style={[s.primary, styles.botaoVoltar]} onPress={() => router.replace('/perfil')}>
            <Text style={s.primaryText}>Voltar ao perfil</Text>
          </TouchableOpacity>
        </View>
      </SubscriptionScreen>
    );
  }

  if (!plano) {
    return (
      <SubscriptionScreen title="Finalizar pedido" onBack={() => router.replace('/gerenciar-assinatura')}>
        <View style={s.card}>
          <Text style={s.planName}>Plano não encontrado</Text>
          <Text style={s.description}>Volte à lista e escolha um plano para continuar.</Text>
          <TouchableOpacity accessibilityRole="button" style={[s.primary, styles.botaoVoltar]} onPress={() => router.replace('/gerenciar-assinatura')}>
            <Text style={s.primaryText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </SubscriptionScreen>
    );
  }

  return (
    <SubscriptionScreen title="Finalizar pedido" onBack={() => router.replace('/gerenciar-assinatura')}>
      <Text style={s.eyebrow}>CHECKOUT HOMEWISE</Text>
      <Text style={s.title}>Revise seu plano</Text>
      <Text style={s.subtitle}>Confira o plano escolhido e informe o endereço da residência.</Text>

      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.icon}><Ionicons name={plano.icone} size={23} color="#76d7cd" /></View>
          <View style={styles.planoResumo}>
            <Text style={s.planName}>{plano.nome}</Text>
            <Text style={s.description}>{plano.descricao}</Text>
          </View>
        </View>
        <PlanPrice value={plano.preco} />
        <View style={s.divider} />
        <PlanBenefits items={plano.beneficios} />
      </View>

      <Text style={styles.tituloSecao}>Endereço da residência</Text>
      <Text style={styles.descricaoSecao}>Usaremos estas informações para identificar o local do serviço.</Text>
      <View style={styles.formulario}>
        <Text style={styles.rotuloCampo}>CEP</Text>
        <TextInput
          accessibilityLabel="CEP"
          style={[styles.campo, erros.cep && styles.campoErro]}
          value={cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep}
          onChangeText={valor => {
            setCep(valor.replace(/\D/g, '').slice(0, 8));
            setRua('');
            setBairro('');
            setCidade('');
            setEstado('');
            setErroBuscaCep('');
            setErros(atual => ({ ...atual, cep: '', rua: '', bairro: '', cidade: '', estado: '' }));
            setCepEncontrado(false);
          }}
          placeholder="00000-000"
          placeholderTextColor="#718895"
          keyboardType="numeric"
          maxLength={9}
        />
        {!!erros.cep && <Text style={styles.erroCampo}>{erros.cep}</Text>}
        {!erros.cep && !!erroBuscaCep && <Text style={styles.erroCampo}>{erroBuscaCep}</Text>}
        {buscandoCep && <Text style={styles.statusCep}>Buscando endereço pelo CEP...</Text>}
        {!buscandoCep && cepEncontrado && <Text style={styles.statusCep}>Endereço encontrado. Confira os dados e complete o endereço.</Text>}

        <Text style={styles.rotuloCampo}>Rua</Text>
        <TextInput
          accessibilityLabel="Rua"
          style={[styles.campo, erros.rua && styles.campoErro]}
          value={rua}
          onChangeText={valor => atualizarCampo('rua', valor)}
          placeholder="Nome da rua"
          placeholderTextColor="#718895"
          autoCapitalize="words"
        />
        {!!erros.rua && <Text style={styles.erroCampo}>{erros.rua}</Text>}

        <Text style={styles.rotuloCampo}>Número</Text>
        <TextInput
          accessibilityLabel="Número"
          style={[styles.campo, erros.numero && styles.campoErro]}
          value={numero}
          onChangeText={valor => atualizarCampo('numero', valor)}
          placeholder="Número"
          placeholderTextColor="#718895"
          keyboardType="numeric"
        />
        {!!erros.numero && <Text style={styles.erroCampo}>{erros.numero}</Text>}

        <Text style={styles.rotuloCampo}>Complemento (opcional)</Text>
        <TextInput
          accessibilityLabel="Complemento opcional"
          style={styles.campo}
          value={complemento}
          onChangeText={valor => atualizarCampo('complemento', valor)}
          placeholder="Apartamento, bloco, referência..."
          placeholderTextColor="#718895"
        />

        <Text style={styles.rotuloCampo}>Bairro</Text>
        <TextInput
          accessibilityLabel="Bairro"
          style={[styles.campo, erros.bairro && styles.campoErro]}
          value={bairro}
          onChangeText={valor => atualizarCampo('bairro', valor)}
          placeholder="Nome do bairro"
          placeholderTextColor="#718895"
          autoCapitalize="words"
        />
        {!!erros.bairro && <Text style={styles.erroCampo}>{erros.bairro}</Text>}

        <Text style={styles.rotuloCampo}>Cidade</Text>
        <TextInput
          accessibilityLabel="Cidade"
          style={[styles.campo, erros.cidade && styles.campoErro]}
          value={cidade}
          onChangeText={valor => atualizarCampo('cidade', valor)}
          placeholder="Cidade"
          placeholderTextColor="#718895"
          autoCapitalize="words"
        />
        {!!erros.cidade && <Text style={styles.erroCampo}>{erros.cidade}</Text>}

        <Text style={styles.rotuloCampo}>Estado (UF)</Text>
        <TextInput
          accessibilityLabel="Estado, UF"
          style={[styles.campo, erros.estado && styles.campoErro]}
          value={estado}
          onChangeText={valor => atualizarCampo('estado', valor)}
          placeholder="UF"
          placeholderTextColor="#718895"
          autoCapitalize="characters"
          maxLength={2}
        />
        {!!erros.estado && <Text style={styles.erroCampo}>{erros.estado}</Text>}
      </View>

      <Text style={styles.tituloSecao}>Formas de pagamento aceitas</Text>
      <Text style={styles.descricaoSecao}>Escolha uma opção para o pedido.</Text>
      <View style={styles.formasPagamento}>
        {formasPagamento.map(forma => {
          const selecionada = formaSelecionada === forma.id;
          return (
            <TouchableOpacity
              key={forma.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selecionada }}
              style={[styles.formaPagamento, selecionada && styles.formaPagamentoSelecionada]}
              onPress={() => {
                setFormaSelecionada(forma.id);
                setErros(atual => ({ ...atual, pagamento: '' }));
              }}
            >
              <View style={styles.formaIcone}><Ionicons name={forma.icone} size={20} color="#76d7cd" /></View>
              <View style={styles.formaTexto}>
                <Text style={styles.formaTitulo}>{forma.titulo}</Text>
                <Text style={styles.formaDetalhe}>{forma.detalhe}</Text>
              </View>
              <Ionicons name={selecionada ? 'radio-button-on' : 'radio-button-off'} size={20} color={selecionada ? '#76d7cd' : '#718895'} />
            </TouchableOpacity>
          );
        })}
      </View>

      {!!erros.pagamento && (
        <View accessibilityRole="alert" style={styles.erros}>
          <Text style={styles.erroTexto}>{erros.pagamento}</Text>
        </View>
      )}

      <TouchableOpacity accessibilityRole="button" style={[s.primary, styles.botaoContinuar]} disabled={buscandoCep} onPress={continuarCheckout}>
        <Text style={s.primaryText}>{buscandoCep ? 'Consultando CEP...' : 'Continuar'}</Text>
        <Ionicons name="arrow-forward" size={17} color="#092c32" />
      </TouchableOpacity>
      <View style={s.note}>
        <Ionicons name="information-circle-outline" size={18} color="#8fa6b3" />
        <Text style={s.noteText}>Esta etapa é demonstrativa. O pagamento e a contratação ainda não estão disponíveis no app.</Text>
      </View>
    </SubscriptionScreen>
  );
}

const styles = StyleSheet.create({
  estadoConsulta: { alignItems: 'center', gap: 14, paddingVertical: 28 },
  planoResumo: { flex: 1 },
  tituloSecao: { color: '#f1f6f8', fontSize: 18, fontWeight: '700', marginTop: 28, marginBottom: 6 },
  descricaoSecao: { color: '#8fa6b3', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  formulario: { gap: 8 },
  rotuloCampo: { color: '#c4d3d8', fontSize: 12, fontWeight: '600', marginTop: 8 },
  campo: {
    minHeight: 48,
    backgroundColor: '#0b1d28',
    borderWidth: 1,
    borderColor: '#1e3a4b',
    borderRadius: 12,
    color: '#eff6f7',
    fontSize: 14,
    paddingHorizontal: 14
  },
  campoErro: { borderColor: '#f87171' },
  erroCampo: { color: '#fca5a5', fontSize: 11, lineHeight: 16, marginTop: -4 },
  statusCep: { color: '#76d7cd', fontSize: 11, lineHeight: 16, marginTop: -2 },
  formasPagamento: { gap: 10 },
  formaPagamento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#0b1d28',
    borderWidth: 1,
    borderColor: '#1e3a4b',
    borderRadius: 14
  },
  formaPagamentoSelecionada: { borderColor: '#76d7cd', backgroundColor: '#0e252d' },
  formaIcone: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#173a40', justifyContent: 'center', alignItems: 'center' },
  formaTexto: { flex: 1, gap: 4 },
  formaTitulo: { color: '#eff5f6', fontSize: 14, fontWeight: '600' },
  formaDetalhe: { color: '#8fa6b3', fontSize: 11 },
  erros: { gap: 5, marginTop: 16 },
  erroTexto: { color: '#fca5a5', fontSize: 12, lineHeight: 18 },
  botaoContinuar: { marginTop: 22 },
  botaoVoltar: { marginTop: 20 }
});
