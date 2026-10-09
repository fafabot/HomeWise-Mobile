import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase';

type Entry = 'login' | 'cadastro' | null;
const AuthContext = createContext<{ user: User | null; loading: boolean; entry: Entry; selectEntry: (entry: Entry) => void }>({ user: null, loading: true, entry: null, selectEntry: () => {} });

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entry, selectEntry] = useState<Entry>(null);
  useEffect(() => onAuthStateChanged(auth, (account) => {
    setUser(account);
    setLoading(false);
  }), []);
  return <AuthContext.Provider value={{ user, loading, entry, selectEntry }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
