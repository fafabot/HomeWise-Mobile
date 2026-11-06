import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import {
  DadosUsuario,
  PreferenciasNotificacoes,
  salvarPerfilFirestore
} from '@/services/authService';
import { obterPlanoPorId, type CicloAssinatura, type PlanoId } from '@/constants/planos';

type Entry = 'login' | 'cadastro' | null;

interface AuthContextType {
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

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (account) => {
      setUser(account);

      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (account) {
        // Escuta o perfil do usuario no Firestore em tempo real
        const userDocRef = doc(db, 'usuarios', account.uid);
        unsubscribeFirestore = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            setPerfil(snapshot.data() as DadosUsuario);
          } else {
            // Se nao existir o documento ainda, cria automaticamente com valores padrao
            const novoPerfil: DadosUsuario = {
              uid: account.uid,
              nome: account.displayName || account.email?.split('@')[0] || 'Morador',
              email: account.email || '',
              dispositivo_id: ''
            };
            setPerfil(novoPerfil);
          }
          setLoading(false);
        }, (error) => {
          console.warn('[Firestore] Erro ao observar perfil:', error);
          setLoading(false);
        });
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const dispositivoId = perfil?.dispositivo_id?.trim() || '';

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
        user,
        perfil,
        dispositivoId,
        loading,
        entry,
        selectEntry,
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
