export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password': return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
    case 'auth/email-already-in-use': return 'Este e-mail já possui uma conta. Entre com sua senha.';
    case 'auth/invalid-email': return 'Informe um e-mail válido.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'A senha não atende aos requisitos de segurança. Use uma senha mais forte.';
    case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
    case 'auth/network-request-failed': return 'Não foi possível conectar. Confira sua conexão com a internet.';
    case 'auth/user-disabled': return 'Esta conta está desativada.';
    case 'auth/operation-not-allowed': return 'O acesso por e-mail e senha precisa ser habilitado no Firebase Authentication.';
    default: return 'Não foi possível concluir. Tente novamente em instantes.';
  }
}
