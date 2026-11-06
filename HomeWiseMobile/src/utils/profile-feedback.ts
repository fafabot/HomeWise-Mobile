import type { ResultadoPerfil } from '@/services/authService';
import { authErrorMessage } from '@/services/authErrors';

/** Somente texto controlado pelo cliente; nunca renderizar erro/causa do SDK. */
export function mensagemPerfil(resultado: ResultadoPerfil, operacao: 'cadastro' | 'recuperacao' | 'edicao'): string {
  if (resultado.sucesso && resultado.estado === 'completo') {
    return operacao === 'edicao' ? 'Perfil atualizado com sucesso!' : 'Perfil concluído. Aguarde a liberação do acesso.';
  }
  if (resultado.estado === 'parcial') {
    if (operacao === 'cadastro') return 'Sua conta foi criada, mas seu perfil ainda precisa ser concluído. Conclua o perfil nesta mesma conta, sem repetir o cadastro.';
    if (operacao === 'recuperacao') return 'Seu perfil ainda não foi concluído. Algumas etapas foram confirmadas. Tente novamente na mesma conta.';
    return 'Algumas alterações foram confirmadas, mas o perfil não foi totalmente salvo. Seus dados foram mantidos; tente salvar novamente.';
  }
  if (operacao === 'cadastro' && !resultado.sucesso && resultado.codigo.startsWith('auth/')) {
    return authErrorMessage({ code: resultado.codigo });
  }
  return operacao === 'edicao'
    ? 'Não foi possível confirmar as alterações. Seus dados foram mantidos; tente salvar novamente.'
    : 'Não foi possível concluir o perfil. Seus dados foram mantidos; tente novamente na mesma conta.';
}
