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
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface DadosUsuario {
  uid: string;
  nome: string;
  email: string;
  dispositivo_id: string;
  telefone?: string;
  cpf?: string;
  foto_perfil?: string;
  metas_consumo?: { agua?: number; energia?: number };
  residencia?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  endereco_detalhado?: {
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  plano?: 'basico' | 'plus' | 'premium' | null;
  plano_nome?: string | null;
  ciclo_assinatura?: 'mensal' | 'anual';
  status_assinatura?: 'ativa' | 'cancelada' | 'inativa';
  metodo_pagamento?: 'pix' | 'cartao';
  assinado_em?: any;
  atualizado_em?: any;
  criado_em?: any;
}

export interface AuthResultado {
  sucesso: boolean;
  usuario?: User;
  erro?: string;
  codigo?: string;
}

export interface EtapasPerfil {
  conta: 'criada' | 'existente' | 'nao-confirmada';
  auth: 'confirmado' | 'nao-confirmado' | 'nao-executado';
  firestore: 'confirmado' | 'nao-confirmado' | 'nao-executado';
}

type EtapaPendente = 'conta' | 'auth' | 'firestore' | 'sessao' | 'validacao';
export type PersistenciaPerfilResultado =
  | { sucesso: true }
  | { sucesso: false; erro: string; codigo: string; causa: unknown };

/** sucesso só é true quando Auth e Firestore estão confirmados. Nunca implica rollback. */
export type ResultadoPerfil = (
  | { sucesso: true; estado: 'completo' }
  | { sucesso: false; estado: 'parcial' | 'falha'; erro: string; codigo: string;
      causa: unknown; etapaPendente: EtapaPendente }
) & { usuario?: User; etapas: EtapasPerfil; recuperavel: boolean };

export type DadosEdicaoPerfil = Partial<Pick<DadosUsuario,
  'dispositivo_id' | 'telefone' | 'cpf' | 'residencia' | 'cep' | 'cidade' | 'estado' | 'endereco_detalhado'>>;
export interface DadosRecuperacaoPerfil { nome?: string; dispositivo_id?: string }

function codigoErro(causa: unknown, fallback: string): string {
  const codigo = (causa as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : fallback;
}

function erroPerfil(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function garantirSessao(usuario: User): void {
  if (auth.currentUser?.uid !== usuario.uid) {
    throw erroPerfil('perfil/sessao-alterada', 'Entre novamente na conta para concluir o perfil.');
  }
}

function falhaPerfil(causa: unknown, etapaPendente: EtapaPendente, etapas: EtapasPerfil,
  erro: string, usuario?: User): ResultadoPerfil {
  const parcial = etapas.conta === 'criada' || etapas.auth === 'confirmado' || etapas.firestore === 'confirmado';
  return { sucesso: false, estado: parcial ? 'parcial' : 'falha', usuario,
    etapas: { ...etapas }, etapaPendente, recuperavel: !!usuario, erro,
    codigo: codigoErro(causa, `perfil/${etapaPendente}-nao-confirmado`), causa };
}

function prepararEdicao(dados: DadosEdicaoPerfil = {}): Partial<DadosUsuario> {
  const permitidos = ['dispositivo_id', 'telefone', 'cpf', 'residencia', 'cep', 'cidade', 'estado', 'endereco_detalhado'];
  const patch: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dados)) {
    if (!permitidos.includes(campo)) throw erroPerfil('perfil/campo-nao-editavel', 'O perfil contém campos que não pertencem a esta edição.');
    if (valor === undefined) continue;
    if (campo === 'endereco_detalhado') {
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw erroPerfil('perfil/dados-invalidos', 'Endereço inválido.');
      const endereco: Record<string, string> = {};
      for (const [chave, texto] of Object.entries(valor)) {
        if (!['rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado'].includes(chave)) throw erroPerfil('perfil/campo-nao-editavel', 'Campo de endereço inválido.');
        if (texto === undefined) continue;
        if (typeof texto !== 'string') throw erroPerfil('perfil/dados-invalidos', 'Endereço inválido.');
        endereco[chave] = texto.trim();
      }
      // Um mapa vazio pode apagar os campos aninhados no Firestore; não o enviar.
      if (Object.keys(endereco).length) patch[campo] = endereco;
    } else {
      if (typeof valor !== 'string') throw erroPerfil('perfil/dados-invalidos', 'Dados do perfil inválidos.');
      patch[campo] = valor.trim();
    }
  }
  return patch;
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
export async function salvarPerfilFirestoreDetalhado(uid: string, dados: Partial<DadosUsuario>): Promise<PersistenciaPerfilResultado> {
  try {
    await setDoc(doc(db, 'usuarios', uid), {
      ...dados,
      atualizado_em: new Date()
    }, { merge: true });
    return { sucesso: true };
  } catch (causa) {
    return { sucesso: false, erro: 'Não foi possível confirmar a gravação do perfil.',
      codigo: codigoErro(causa, 'perfil/persistencia-nao-confirmada'), causa };
  }
}

/** Compatibilidade: foto, metas e assinatura continuam recebendo boolean. */
export async function salvarPerfilFirestore(uid: string, dados: Partial<DadosUsuario>): Promise<boolean> {
  return (await salvarPerfilFirestoreDetalhado(uid, dados)).sucesso;
}

async function concluirPerfil(usuario: User, nome: string, dados: Partial<DadosUsuario>,
  conta: EtapasPerfil['conta']): Promise<ResultadoPerfil> {
  const etapas: EtapasPerfil = { conta, auth: 'nao-executado', firestore: 'nao-executado' };
  try {
    garantirSessao(usuario);
    etapas.auth = 'nao-confirmado';
    await updateProfile(usuario, { displayName: nome });
    etapas.auth = 'confirmado';
  } catch (causa) {
    return falhaPerfil(causa, 'auth', etapas, conta === 'criada'
      ? 'Sua conta foi criada, mas o nome não foi confirmado. Não crie outra conta; conclua o perfil na mesma conta.'
      : 'Não foi possível confirmar a atualização do nome na conta. O perfil não foi salvo.', usuario);
  }
  try {
    garantirSessao(usuario);
  } catch (causa) {
    return falhaPerfil(causa, 'sessao', etapas, 'A sessão mudou. Entre na mesma conta para concluir as alterações.', usuario);
  }
  etapas.firestore = 'nao-confirmado';
  const persistencia = await salvarPerfilFirestoreDetalhado(usuario.uid, dados);
  if (!persistencia.sucesso) {
    return falhaPerfil(persistencia.causa, 'firestore', etapas, conta === 'criada'
      ? 'Sua conta foi criada, mas o perfil não foi confirmado. Não refaça o cadastro; conclua o perfil na mesma conta.'
      : 'O nome foi atualizado na conta, mas as alterações do perfil não foram confirmadas. Tente salvar novamente.', usuario);
  }
  etapas.firestore = 'confirmado';
  return { sucesso: true, estado: 'completo', usuario, etapas, recuperavel: false };
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
  dispositivoId: string = ''
): Promise<ResultadoPerfil> {
  let user: User;
  try {
    const credenciais = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    user = credenciais.user;
  } catch (causa) {
    const codigo = codigoErro(causa, 'perfil/conta-nao-confirmada');
    let mensagem = 'Erro ao cadastrar usuário.';
    if (codigo === 'auth/email-already-in-use') {
      mensagem = 'Este e-mail já está cadastrado. Entre na mesma conta para concluir o perfil, se necessário.';
    } else if (codigo === 'auth/weak-password') {
      mensagem = 'A senha deve conter no mínimo 6 caracteres.';
    } else if (codigo === 'auth/invalid-email') {
      mensagem = 'Formato de e-mail inválido.';
    }
    return falhaPerfil(causa, 'conta', { conta: 'nao-confirmada', auth: 'nao-executado', firestore: 'nao-executado' }, mensagem);
  }
  const nomeExibicao = nome?.trim() || email.trim().split('@')[0];
  return concluirPerfil(user, nomeExibicao, { uid: user.uid, nome: nomeExibicao,
    email: email.trim().toLowerCase(), dispositivo_id: dispositivoId.trim(), criado_em: new Date() }, 'criada');
}

/**
 * Atualiza o perfil do usuario no Auth e no Firestore
 */
export async function atualizarPerfilUsuario(
  nome: string,
  dadosExtras?: DadosEdicaoPerfil
): Promise<ResultadoPerfil> {
  const usuario = auth.currentUser;
  const etapas: EtapasPerfil = { conta: usuario ? 'existente' : 'nao-confirmada', auth: 'nao-executado', firestore: 'nao-executado' };
  if (!usuario) return falhaPerfil(erroPerfil('auth/unauthenticated', 'Nenhum usuário logado.'), 'sessao', etapas, 'Nenhum usuário logado.');
  let dados: Partial<DadosUsuario>;
  try {
    if (!nome.trim()) throw erroPerfil('perfil/nome-invalido', 'Informe um nome para salvar o perfil.');
    dados = prepararEdicao(dadosExtras);
  } catch (causa) {
    return falhaPerfil(causa, 'validacao', etapas, 'Não foi possível salvar: confira os campos editáveis e o nome.', usuario);
  }
  return concluirPerfil(usuario, nome.trim(), { ...dados, nome: nome.trim() }, 'existente');
}

/** Inicializa somente campos ausentes da conta atual, sem criar outra conta. */
export async function recuperarPerfilIncompleto(
  dados: DadosRecuperacaoPerfil = {}
): Promise<ResultadoPerfil> {
  const usuario = auth.currentUser;
  const etapas: EtapasPerfil = { conta: usuario ? 'existente' : 'nao-confirmada', auth: 'nao-executado', firestore: 'nao-executado' };
  if (!usuario?.email) return falhaPerfil(erroPerfil('auth/unauthenticated', 'Entre na mesma conta para recuperar o perfil.'),
    'sessao', etapas, 'Entre na mesma conta para recuperar o perfil.');
  if (!dados || typeof dados !== 'object' || Object.entries(dados).some(([campo, valor]) =>
    !['nome', 'dispositivo_id'].includes(campo) || (valor !== undefined && typeof valor !== 'string'))) {
    return falhaPerfil(erroPerfil('perfil/dados-invalidos', 'Dados de recuperação inválidos.'),
      'validacao', etapas, 'Confira os dados para concluir o perfil na mesma conta.', usuario);
  }
  const email = usuario.email.trim().toLowerCase();
  const nomePadrao = dados.nome?.trim() || usuario.displayName?.trim() || email.split('@')[0];
  let nomeConfirmado: string;
  etapas.firestore = 'nao-confirmado';
  try {
    garantirSessao(usuario);
    nomeConfirmado = await runTransaction(db, async transaction => {
      const ref = doc(db, 'usuarios', usuario.uid);
      const snapshot = await transaction.get(ref);
      garantirSessao(usuario);
      const existente = snapshot.exists() ? snapshot.data() : {};
      if (existente.uid && existente.uid !== usuario.uid) throw erroPerfil('perfil/uid-incompativel', 'O perfil pertence a outra identidade.');
      if (existente.email && (typeof existente.email !== 'string' || existente.email.toLowerCase() !== email)) throw erroPerfil('perfil/email-incompativel', 'O e-mail do perfil precisa de revisão.');
      if (existente.dispositivo_id !== undefined && typeof existente.dispositivo_id !== 'string') throw erroPerfil('perfil/dados-invalidos', 'O identificador da central precisa de revisão.');
      const nomeExistente = typeof existente.nome === 'string' ? existente.nome.trim() : '';
      const patch: Partial<DadosUsuario> = {};
      if (!existente.uid) patch.uid = usuario.uid;
      if (!existente.email) patch.email = email;
      if (!nomeExistente) patch.nome = nomePadrao;
      if (existente.dispositivo_id === undefined) patch.dispositivo_id = dados.dispositivo_id?.trim() || '';
      if (existente.criado_em === undefined) patch.criado_em = new Date();
      if (Object.keys(patch).length) transaction.set(ref, { ...patch, atualizado_em: new Date() }, { merge: true });
      return nomeExistente || nomePadrao;
    });
    etapas.firestore = 'confirmado';
  } catch (causa) {
    return falhaPerfil(causa, 'firestore', etapas, 'Não foi possível confirmar a recuperação do perfil. A conta existente foi preservada.', usuario);
  }
  try {
    garantirSessao(usuario);
    etapas.auth = 'nao-confirmado';
    await updateProfile(usuario, { displayName: nomeConfirmado });
    etapas.auth = 'confirmado';
  } catch (causa) {
    return falhaPerfil(causa, 'auth', etapas, 'O perfil foi confirmado, mas o nome na conta ainda não. Tente concluir novamente na mesma conta.', usuario);
  }
  return { sucesso: true, estado: 'completo', usuario, etapas, recuperavel: false };
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
