import AuthScreen from '@/components/AuthScreen';
import { useAuth } from '@/contexts/AuthContext';
export default function CadastroScreen() {
  const { chaveFormulario } = useAuth();
  return <AuthScreen key={chaveFormulario} mode="cadastro" />;
}
