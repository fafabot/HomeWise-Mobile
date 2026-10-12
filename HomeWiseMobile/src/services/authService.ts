import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface DadosUsuario {
  uid: string;
  nome: string;
  email: string;
  dispositivo_id: string;
  telefone?: string;
  residencia?: string;
  cep?: string;
  atualizado_em?: any;
  criado_em?: any;
}

export interface AuthResultado {
  sucesso: boolean;
  usuario?: User;
  erro?: string;
  codigo?: string;
}

/**
 * Busca os dados complementares do usuario no Firestore
 */
export async function obterPerfilFirestore(uid: string): Promise<DadosUsuario | null> {
  try {
    const docSnap = await getDoc(doc(db, 'usuarios', uid));
    if (docSnap.exists()) {
      return docSnap.data() as DadosUsuario;
    }
    return null;
  } catch (error) {
    console.warn('[Firestore] Erro ao buscar perfil:', error);
    return null;
  }
}

/**
 * Salva ou atualiza os dados do usuario no Firestore
 */
export async function salvarPerfilFirestore(uid: string, dados: Partial<DadosUsuario>): Promise<boolean> {
  try {
    await setDoc(doc(db, 'usuarios', uid), {
      ...dados,
      atualizado_em: new Date()
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firestore] Erro ao salvar perfil:', error);
    return false;
  }
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
 * Cria uma nova conta sincronizando Firebase Auth e Cloud Firestore
 */
export async function cadastrarUsuario(
  email: string,
  senha: string,
  nome?: string,
  dispositivoId: string = 'central_homewise_01'
): Promise<AuthResultado> {
  try {
    const credenciais = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    const user = credenciais.user;
    if (user) {
      const nomeExibicao = nome?.trim() || email.split('@')[0];
      await updateProfile(user, { displayName: nomeExibicao });

      // Salva documento sincronizado no Firestore
      await salvarPerfilFirestore(user.uid, {
        uid: user.uid,
        nome: nomeExibicao,
        email: email.trim().toLowerCase(),
        dispositivo_id: dispositivoId.trim() || 'central_homewise_01',
        criado_em: new Date()
      } as any);
    }
    return { sucesso: true, usuario: user };
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
 * Atualiza o perfil do usuario no Auth e no Firestore
 */
export async function atualizarPerfilUsuario(
  nome: string,
  dadosExtras?: Partial<DadosUsuario>
): Promise<AuthResultado> {
  try {
    const usuario = auth.currentUser;
    if (!usuario) {
      return { sucesso: false, erro: 'Nenhum usuário logado.' };
    }
    const nomeLimpo = nome.trim();
    await updateProfile(usuario, { displayName: nomeLimpo });

    // Salva no Firestore
    await salvarPerfilFirestore(usuario.uid, {
      uid: usuario.uid,
      nome: nomeLimpo,
      ...dadosExtras
    });

    return { sucesso: true, usuario };
  } catch (error: any) {
    return { sucesso: false, erro: 'Erro ao atualizar perfil.', codigo: error.code };
  }
}

/**
 * Altera a senha do usuario no Firebase Auth com reautenticacao
 */
export async function alterarSenhaUsuario(senhaAtual: string, novaSenha: string): Promise<AuthResultado> {
  try {
    const usuario = auth.currentUser;
    if (!usuario || !usuario.email) {
      return { sucesso: false, erro: 'Nenhum usuário logado.' };
    }

    if (novaSenha.length < 6) {
      return { sucesso: false, erro: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const credencial = EmailAuthProvider.credential(usuario.email, senhaAtual);
    await reauthenticateWithCredential(usuario, credencial);
    await updatePassword(usuario, novaSenha);
    return { sucesso: true };
  } catch (error: any) {
    let mensagem = 'Erro ao alterar a senha.';
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      mensagem = 'A senha atual está incorreta.';
    } else if (error.code === 'auth/weak-password') {
      mensagem = 'A nova senha deve ter no mínimo 6 caracteres.';
    }
    return { sucesso: false, erro: mensagem, codigo: error.code };
  }
}

/**
 * Envia e-mail para recuperacao de senha
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
 * Observa o estado de autenticacao
 */
export function observarAuth(callback: (usuario: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Retorna o usuario atual
 */
export function obterUsuarioAtual(): User | null {
  return auth.currentUser;
}
