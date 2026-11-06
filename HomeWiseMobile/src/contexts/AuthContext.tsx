import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, reload, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { DadosUsuario, type PreferenciasNotificacoes, salvarPerfilFirestore, type ResultadoPerfil } from '@/services/authService';
import { obterPlanoPorId, type CicloAssinatura, type PlanoId } from '@/constants/planos';

type EstadoPerfil = 'sem-sessao' | 'verificando' | 'ausente' | 'incompleto' | 'erro' | 'completo';
type Operacao = { token: number; uid?: string; email: string };
type Entry = 'login' | 'cadastro' | null;

function identidadePersistidaValida(user: User, perfil: DadosUsuario | null) {
  return !!perfil && perfil.uid === user.uid && typeof perfil.nome === 'string' && !!perfil.nome.trim() &&
    typeof perfil.email === 'string' && !!user.email &&
    perfil.email.trim().toLowerCase() === user.email.trim().toLowerCase();
}

function nomeAuthConfere(user: User, perfil: DadosUsuario | null) {
  return identidadePersistidaValida(user, perfil) && user.displayName?.trim() === perfil!.nome.trim();
}

interface AuthContextType {
  estadoPerfil: EstadoPerfil;
  perfilConcluido: boolean;
  operacaoPerfil: boolean;
  chaveFormulario: number;
  iniciarOperacaoPerfil: (email: string) => number | null;
  finalizarOperacaoPerfil: (token: number, resultado?: ResultadoPerfil) => void;
  tentarNovamentePerfil: () => void;
  sairDaConta: () => Promise<void>;
  saindo: boolean;
  erroSaida: boolean;
  user: User | null;
  perfil: DadosUsuario | null;
  dispositivoId: string;
  loading: boolean;
  entry: Entry;
  selectEntry: (entry: Entry) => void;
  atualizarDispositivoId: (novoId: string) => Promise<boolean>;
  atualizarPlanoAssinatura: (
    planoId: PlanoId,
    ciclo?: CicloAssinatura,
    dadosFaturamento?: Partial<DadosUsuario>
  ) => Promise<boolean>;
  cancelarAssinatura: () => Promise<boolean>;
  atualizarPreferenciasNotificacoes: (prefs: PreferenciasNotificacoes) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  estadoPerfil: 'sem-sessao', perfilConcluido: false, operacaoPerfil: false,
  chaveFormulario: 0, iniciarOperacaoPerfil: () => null, finalizarOperacaoPerfil: () => {},
  tentarNovamentePerfil: () => {}, sairDaConta: async () => {}, saindo: false, erroSaida: false,
  user: null,
  perfil: null,
  dispositivoId: '',
  loading: true,
  entry: null,
  selectEntry: () => {},
  atualizarDispositivoId: async () => false,
  atualizarPlanoAssinatura: async () => false,
  cancelarAssinatura: async () => false,
  atualizarPreferenciasNotificacoes: async () => false
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<DadosUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [entry, selectEntry] = useState<Entry>(null);

  const [consulta, setConsulta] = useState<EstadoPerfil>('sem-sessao');
  const [authConfirmado, setAuthConfirmado] = useState(false);
  const [sessaoValidada, setSessaoValidada] = useState(false);
  const [erroAuth, setErroAuth] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [operacaoPerfil, setOperacaoPerfil] = useState(false);
  const [chaveFormulario, setChaveFormulario] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState(false);
  const atual = useRef<User | null>(null);
  const operacao = useRef<Operacao | null>(null);
  const criacaoEsperada = useRef<Operacao | null>(null);
  const versaoAuth = useRef(0);
  const authVerificado = useRef(false);
  const perfilServidor = useRef<DadosUsuario | null>(null);
  const sequencia = useRef(0);
  const geracao = useRef(0);
  const cancelando = useRef(false);
  const saidaLimpa = useRef(false);
  const normalizar = (valor?: string | null) => (valor || '').trim().toLowerCase();

  function concluirSaida() {
    if (saidaLimpa.current) return;
    saidaLimpa.current = true;
    atual.current = null;
    operacao.current = null;
    criacaoEsperada.current = null;
    perfilServidor.current = null;
    authVerificado.current = false;
    setUser(null);
    setPerfil(null);
    setConsulta('sem-sessao');
    setAuthConfirmado(false);
    setSessaoValidada(false);
    setErroAuth(false);
    setBloqueado(false);
    setOperacaoPerfil(false);
    setErroSaida(false);
    setSaindo(false);
    selectEntry(null);
    setChaveFormulario(n => n + 1);
    setLoading(false);
  }

  useEffect(() => {
    let ativo = true;
    const unsub = onAuthStateChanged(auth, account => {
      if (!ativo) return;
      if (account?.uid !== auth.currentUser?.uid) return;
      if (cancelando.current && !account) {
        concluirSaida();
        return;
      }
      if (cancelando.current && account) {
        void signOut(auth).catch(() => {
          if (!ativo || auth.currentUser?.uid !== account.uid) return;
          // If rejecting a late sign-in also fails, expose the actual session
          // and a retryable logout instead of claiming the account is signed out.
          cancelando.current = false;
          geracao.current++;
          atual.current = account;
          authVerificado.current = false;
          perfilServidor.current = null;
          setUser(account);
          setPerfil(null);
          setAuthConfirmado(false);
          setSessaoValidada(false);
          setBloqueado(true);
          setConsulta('verificando');
          setChaveFormulario(n => n + 1);
          setErroSaida(true);
        });
        return;
      }
      const anterior = atual.current;
      const criacao = criacaoEsperada.current;
      const propriaCriacao = !anterior && account && criacao &&
        (!criacao.uid || criacao.uid === account.uid) && normalizar(account.email) === criacao.email;
      if (anterior !== account) {
        setConsulta(account ? 'verificando' : 'sem-sessao');
        setPerfil(null);
        perfilServidor.current = null;
        setErroAuth(false);
        if (!propriaCriacao) {
          setAuthConfirmado(false);
          authVerificado.current = false;
        }
      }
      if (anterior?.uid !== account?.uid) {
        geracao.current++;
        setErroSaida(false);
        setPerfil(null);
        setSessaoValidada(false);
        if (!propriaCriacao) setAuthConfirmado(false);
        setErroAuth(false);
        setConsulta(account ? 'verificando' : 'sem-sessao');
        if (propriaCriacao) {
          if (operacao.current) operacao.current.uid = account!.uid;
          criacaoEsperada.current = null;
        } else {
          criacaoEsperada.current = null;
          operacao.current = null;
          setOperacaoPerfil(false);
          setBloqueado(false);
          setChaveFormulario(n => n + 1);
        }
      }
      atual.current = account;
      setUser(account);
      setLoading(false);
    });
    return () => { ativo = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const conta = user;
    const versao = geracao.current;
    let ativo = true;
    const valido = () => ativo && versao === geracao.current && atual.current?.uid === conta.uid;
    if (!operacao.current) {
      const versao = ++versaoAuth.current;
      void reload(conta).then(() => {
        if (valido() && versao === versaoAuth.current && !operacao.current) {
          authVerificado.current = true;
          setAuthConfirmado(true);
          if (nomeAuthConfere(conta, perfilServidor.current)) setSessaoValidada(true);
        }
      }).catch(() => { if (valido() && versao === versaoAuth.current) setErroAuth(true); });
    }
    let erroLeitura = false;
    const unsub = onSnapshot(doc(db, 'usuarios', conta.uid), { includeMetadataChanges: true }, snapshot => {
      if (!valido() || erroLeitura) return;
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
        // Keep the last authoritative profile during local edits. A local echo
        // must neither confirm a new session nor unmount an established editor.
        return;
      }
      if (!snapshot.exists()) {
        perfilServidor.current = null;
        setPerfil(null);
        setConsulta('ausente');
        return;
      }
      const dados = snapshot.data() as DadosUsuario;
      perfilServidor.current = dados;
      setPerfil(dados);
      if (authVerificado.current && !operacao.current && nomeAuthConfere(conta, dados)) setSessaoValidada(true);
      setConsulta('incompleto');
    }, () => {
      if (!valido()) return;
      erroLeitura = true;
      perfilServidor.current = null;
      setPerfil(null);
      setConsulta('erro');
    });
    return () => { ativo = false; unsub(); };
  }, [user, tentativa]);

  function iniciarOperacaoPerfil(email: string): number | null {
    if (operacao.current || cancelando.current || auth.currentUser?.uid !== atual.current?.uid) return null;
    const token = ++sequencia.current;
    operacao.current = { token, uid: atual.current?.uid, email: normalizar(email) };
    if (!atual.current) criacaoEsperada.current = operacao.current;
    versaoAuth.current++;
    authVerificado.current = false;
    setAuthConfirmado(false);
    setErroAuth(false);
    setOperacaoPerfil(true);
    setBloqueado(true);
    return token;
  }

  function finalizarOperacaoPerfil(token: number, resultado?: ResultadoPerfil) {
    const pendente = operacao.current;
    if (!pendente || pendente.token !== token) return;
    const conta = auth.currentUser;
    if (conta && normalizar(conta.email) !== pendente.email) return;
    if (pendente.uid && conta?.uid !== pendente.uid) return;
    if (conta) pendente.uid = conta.uid;
    const completo = resultado?.sucesso === true && resultado.estado === 'completo' &&
      resultado.etapas.auth === 'confirmado' && resultado.etapas.firestore === 'confirmado' &&
      resultado.usuario?.uid === conta?.uid;
    operacao.current = null;
    if (!conta) criacaoEsperada.current = null;
    setOperacaoPerfil(false);
    setBloqueado(!!conta && !completo);
    setAuthConfirmado(completo);
    authVerificado.current = completo;
    if (completo && conta && nomeAuthConfere(conta, perfilServidor.current)) setSessaoValidada(true);
  }

  function tentarNovamentePerfil() {
    if (operacao.current) return;
    perfilServidor.current = null;
    authVerificado.current = false;
    setAuthConfirmado(false);
    setErroAuth(false);
    setPerfil(null);
    setConsulta(atual.current ? 'verificando' : 'sem-sessao');
    setTentativa(n => n + 1);
  }

  async function sairDaConta() {
    if (cancelando.current) return;
    cancelando.current = true;
    saidaLimpa.current = false;
    geracao.current++;
    const versaoDaSaida = geracao.current;
    operacao.current = null;
    criacaoEsperada.current = null;
    versaoAuth.current++;
    setOperacaoPerfil(false);
    setSaindo(true);
    setErroSaida(false);
    try {
      await signOut(auth);
      if (versaoDaSaida !== geracao.current) return;
      if (auth.currentUser) throw new Error('Session still active');
      concluirSaida();
    } catch {
      if (versaoDaSaida !== geracao.current) return;
      if (!auth.currentUser) concluirSaida();
      else {
        cancelando.current = false;
        setErroSaida(true);
        // Keep the current screen/profile on failure; renew invalidated listeners.
        setTentativa(n => n + 1);
      }
    } finally { if (versaoDaSaida === geracao.current) setSaindo(false); }
  }

  const perfilValido = !!user && identidadePersistidaValida(user, perfil) &&
    (sessaoValidada || nomeAuthConfere(user, perfil));
  const perfilConcluido = consulta === 'incompleto' && perfilValido && authConfirmado &&
    !erroAuth && !bloqueado && !operacaoPerfil;
  const estadoPerfil: EstadoPerfil = erroAuth ? 'erro' : perfilConcluido ? 'completo' : consulta;

  const dispositivoId = typeof perfil?.dispositivo_id === 'string' ? perfil.dispositivo_id.trim() : '';

  async function atualizarDispositivoId(novoId: string): Promise<boolean> {
    if (!user) return false;
    return await salvarPerfilFirestore(user.uid, {
      dispositivo_id: novoId.trim()
    });
  }

  async function atualizarPlanoAssinatura(
    planoId: PlanoId,
    ciclo: CicloAssinatura = 'mensal',
    dadosFaturamento?: Partial<DadosUsuario>
  ): Promise<boolean> {
    if (!user) return false;
    const infoPlano = obterPlanoPorId(planoId);
    const dados: Partial<DadosUsuario> = {
      ...dadosFaturamento,
      plano: planoId,
      plano_nome: infoPlano?.nome || planoId,
      ciclo_assinatura: ciclo,
      status_assinatura: 'ativa',
      assinado_em: new Date()
    };
    const ok = await salvarPerfilFirestore(user.uid, dados);
    if (!ok || auth.currentUser?.uid !== user.uid) return false;
    setPerfil(atual => atual?.uid === user.uid ? { ...atual, ...dados } : atual);
    return true;
  }

  async function cancelarAssinatura(): Promise<boolean> {
    if (!user) return false;
    const dados: Partial<DadosUsuario> = {
      plano: null,
      plano_nome: null,
      status_assinatura: 'cancelada'
    };
    const ok = await salvarPerfilFirestore(user.uid, dados);
    if (!ok || auth.currentUser?.uid !== user.uid) return false;
    setPerfil(atual => atual?.uid === user.uid ? { ...atual, ...dados } : atual);
    return true;
  }

  async function atualizarPreferenciasNotificacoes(
    prefs: PreferenciasNotificacoes
  ): Promise<boolean> {
    setPerfil((atual) => (atual ? { ...atual, preferencias_notificacoes: prefs } : atual));
    if (!user) return false;
    return await salvarPerfilFirestore(user.uid, {
      preferencias_notificacoes: prefs
    });
  }

  return (
    <AuthContext.Provider
      value={{
        estadoPerfil, perfilConcluido, operacaoPerfil, chaveFormulario,
        iniciarOperacaoPerfil, finalizarOperacaoPerfil, tentarNovamentePerfil, sairDaConta,
        saindo, erroSaida,
        user,
        perfil,
        dispositivoId,
        loading,
        entry,
        selectEntry: value => { if (!operacao.current && !atual.current) { cancelando.current = false; selectEntry(value); } },
        atualizarDispositivoId,
        atualizarPlanoAssinatura,
        cancelarAssinatura,
        atualizarPreferenciasNotificacoes
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
