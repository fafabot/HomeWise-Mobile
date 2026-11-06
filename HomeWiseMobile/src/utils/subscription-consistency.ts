import type { DadosUsuario } from '@/services/authService';

const campos = ['plano', 'plano_nome', 'ciclo_assinatura', 'status_assinatura',
  'metodo_pagamento', 'assinado_em', 'assinatura_operacao_id', 'assinatura_atualizada_em'] as const;
export type OperacaoAssinatura = {
  id: string;
  base: Partial<DadosUsuario>;
  patch: Partial<DadosUsuario>;
  confirmada: boolean;
  finalizada?: boolean;
  revisao?: number;
  inconsistente?: boolean;
  consultaAutomaticaFeita?: boolean;
};

export function camposAssinatura(perfil: Partial<DadosUsuario>): Partial<DadosUsuario> {
  return Object.fromEntries(campos.filter(campo => campo in perfil).map(campo => [campo, perfil[campo]]));
}

function revisao(perfil: Partial<DadosUsuario>): number | undefined {
  const timestamp = perfil.assinatura_atualizada_em;
  const valor = typeof timestamp?.toMillis === 'function' ? timestamp.toMillis() : undefined;
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : undefined;
}

export function semAssinatura(dados: DadosUsuario): DadosUsuario {
  const resultado = { ...dados };
  for (const campo of campos) delete resultado[campo];
  return resultado;
}

function mesmoConteudo(dados: Partial<DadosUsuario>, esperado: Partial<DadosUsuario>): boolean {
  return (['plano', 'plano_nome', 'ciclo_assinatura', 'status_assinatura', 'metodo_pagamento'] as const)
    .every(campo => dados[campo] === esperado[campo]);
}

/** A server read resolves evidence; no write or fabricated replacement receipt. */
export function resolverConsultaServidor(dados: DadosUsuario, operacao: OperacaoAssinatura): boolean {
  const recebida = revisao(dados);
  const mesmoId = dados.assinatura_operacao_id === operacao.id;
  const confirmaRecibo = mesmoId && mesmoConteudo(dados, operacao.patch) && recebida !== undefined &&
    (operacao.revisao === undefined || recebida === operacao.revisao);
  const nomes = { basico: 'Básico', plus: 'Plus', premium: 'Premium' };
  const conteudoValido = ['mensal', 'anual'].includes(dados.ciclo_assinatura || '') &&
    ((dados.status_assinatura === 'ativa' && dados.plano != null &&
      Object.hasOwn(nomes, dados.plano) && nomes[dados.plano] === dados.plano_nome) ||
      (['cancelada', 'inativa'].includes(dados.status_assinatura || '') && dados.plano === null && dados.plano_nome === null));
  const posterior = !mesmoId && typeof dados.assinatura_operacao_id === 'string' && !!dados.assinatura_operacao_id &&
    recebida !== undefined && operacao.revisao !== undefined && recebida > operacao.revisao && conteudoValido;
  if ((!operacao.confirmada && !operacao.finalizada) || (!confirmaRecibo && !posterior)) return false;
  operacao.inconsistente = false;
  operacao.confirmada = true;
  operacao.id = dados.assinatura_operacao_id!;
  operacao.revisao = recebida;
  operacao.base = camposAssinatura(dados);
  operacao.patch = operacao.base;
  return true;
}

/** Only called with authoritative server snapshots. Never accepts a local echo as acknowledgement. */
export function conciliarAssinatura(dados: DadosUsuario, operacao: OperacaoAssinatura | null): DadosUsuario {
  if (!operacao) return dados;
  if (operacao.inconsistente) return semAssinatura(dados);
  const mesma = dados.assinatura_operacao_id === operacao.id;
  const recebida = revisao(dados);
  const metadadosReutilizados = mesma && (!mesmoConteudo(dados, operacao.patch) ||
    (operacao.revisao !== undefined && recebida !== undefined && recebida !== operacao.revisao));
  const empate = !mesma && recebida !== undefined && recebida === operacao.revisao;
  if (metadadosReutilizados || empate) {
    operacao.inconsistente = true;
    return semAssinatura(dados);
  }
  const maisNova = recebida !== undefined && (operacao.revisao === undefined ? mesma :
    recebida > operacao.revisao || (mesma && recebida === operacao.revisao));
  if (operacao.confirmada && maisNova) {
    operacao.base = camposAssinatura(dados);
    operacao.patch = operacao.base;
    operacao.revisao = recebida ?? operacao.revisao;
    operacao.id = dados.assinatura_operacao_id || operacao.id;
  }
  if (!operacao.confirmada && mesma && recebida !== undefined) operacao.revisao = recebida;
  const resultado = { ...dados };
  for (const campo of campos) delete resultado[campo];
  return { ...resultado, ...(operacao.confirmada ? operacao.patch : operacao.base) };
}
