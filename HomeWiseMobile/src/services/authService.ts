import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { auth } from './firebase';

export interface AuthResultado {
  sucesso: boolean;
  usuario?: User;
  erro?: string;
  codigo?: string;
}

/**
 * Realiza login do usuario com E-mail e Senha
 */
export async function loginUsuario(email: string, senha: string): Promise<AuthResultado> {
  try {
    const credenciais = await signInWithEmailAndPassword(auth, email.trim(), senha);
    return { sucesso: true, usuario: credenciais.user };
  } catch (error: any) {
    let mensagem = 'Erro ao fazer login.';
    if (
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/wrong-password' ||
      error.code === 'auth/invalid-credential'
    ) {
      mensagem = 'E-mail ou senha incorretos.';
    } else if (error.code === 'auth/invalid-email') {
      mensagem = 'Formato de e-mail inválido.';
    } else if (error.code === 'auth/too-many-requests') {
      mensagem = 'Muitas tentativas sem sucesso. Tente novamente mais tarde.';
    }
    return { sucesso: false, erro: mensagem, codigo: error.code };
  }
}

/**
 * Cria uma nova conta com E-mail e Senha
 */
export async function cadastrarUsuario(email: string, senha: string): Promise<AuthResultado> {
  try {
    const credenciais = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    return { sucesso: true, usuario: credenciais.user };
  } catch (error: any) {
    let mensagem = 'Erro ao cadastrar usuário.';
    if (error.code === 'auth/email-already-in-use') {
      mensagem = 'Este e-mail já está cadastrado.';
    } else if (error.code === 'auth/weak-password') {
      mensagem = 'A senha deve conter no mínimo 6 caracteres.';
    } else if (error.code === 'auth/invalid-email') {
      mensagem = 'Formato de e-mail inválido.';
    }
    return { sucesso: false, erro: mensagem, codigo: error.code };
  }
}

/**
 * Envia e-mail para recuperacao de senha (Esqueci minha senha do Figma)
 */
export async function recuperarSenha(email: string): Promise<AuthResultado> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { sucesso: true };
  } catch (error: any) {
    let mensagem = 'Erro ao enviar e-mail de recuperação.';
    if (error.code === 'auth/user-not-found') {
      mensagem = 'Nenhuma conta encontrada com este e-mail.';
    } else if (error.code === 'auth/invalid-email') {
      mensagem = 'Formato de e-mail inválido.';
    }
    return { sucesso: false, erro: mensagem, codigo: error.code };
  }
}

/**
 * Desconecta o usuario atual
 */
export async function deslogarUsuario(): Promise<void> {
  await signOut(auth);
}

/**
 * Observa se o usuario esta logado ou deslogado em tempo real
 */
export function observarAuth(callback: (usuario: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Retorna o usuario atualmente logado (se houver)
 */
export function obterUsuarioAtual(): User | null {
  return auth.currentUser;
}
