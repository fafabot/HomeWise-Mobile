import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "./firebaseConfig";

/**
 * Realiza login do usuario com email e senha
 */
export async function loginUsuario(email, senha) {
  try {
    const credenciais = await signInWithEmailAndPassword(auth, email.trim(), senha);
    return { sucesso: true, usuario: credenciais.user };
  } catch (error) {
    let mensagem = "Erro ao fazer login.";
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      mensagem = "E-mail ou senha incorretos.";
    } else if (error.code === "auth/invalid-email") {
      mensagem = "Formato de e-mail inválido.";
    }
    return { sucesso: false, erro: mensagem, codigo: error.code };
  }
}

/**
 * Cadastra um novo usuario
 */
export async function cadastrarUsuario(email, senha) {
  try {
    const credenciais = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    return { sucesso: true, usuario: credenciais.user };
  } catch (error) {
    let mensagem = "Erro ao cadastrar usuário.";
    if (error.code === "auth/email-already-in-use") {
      mensagem = "Este e-mail já está cadastrado.";
    } else if (error.code === "auth/weak-password") {
      mensagem = "A senha deve conter no mínimo 6 caracteres.";
    }
    return { sucesso: false, erro: mensagem, codigo: error.code };
  }
}

/**
 * Desconecta o usuario atual
 */
export async function deslogarUsuario() {
  await signOut(auth);
}

/**
 * Escuta alteracoes no estado de autenticacao (se esta logado ou nao)
 */
export function observarAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

