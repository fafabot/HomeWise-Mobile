import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { DadosUsuario, salvarPerfilFirestore } from '@/services/authService';

type Entry = 'login' | 'cadastro' | null;

interface AuthContextType {
  user: User | null;
  perfil: DadosUsuario | null;
  dispositivoId: string;
  loading: boolean;
  entry: Entry;
  selectEntry: (entry: Entry) => void;
  atualizarDispositivoId: (novoId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: null,
  dispositivoId: '',
  loading: true,
  entry: null,
  selectEntry: () => {},
  atualizarDispositivoId: async () => false
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

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil,
        dispositivoId,
        loading,
        entry,
        selectEntry,
        atualizarDispositivoId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
