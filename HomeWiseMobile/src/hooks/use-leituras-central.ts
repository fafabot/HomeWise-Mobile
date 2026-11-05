import { useEffect, useState } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { observarHistorico, observarUltimaLeitura, type Leitura } from '@/services/leiturasService';
import { observarHistoricoDiario, type ConsumoDiario } from '@/services/baselineService';

/**
 * Estados de interface para as consultas da central, conforme docs/leituras-contract.md
 * e docs/historico-diario-contract.md.
 *
 * - Cada fonte (última leitura, histórico bruto, histórico diário) tem estado próprio:
 *   o sucesso de uma não apaga o erro de outra.
 * - Cada troca de usuário ou central abre uma nova sessão: dados e erros anteriores deixam de valer,
 *   inclusive ao voltar para uma central já vista (A → B → A).
 * - "Tentar novamente" só ocorre por ação do usuário e recria apenas as assinaturas com erro.
 *   Os dados já recebidos são mantidos e marcados como desatualizados enquanto houver erro.
 * - Não há repetição automática: o contrato encerra a assinatura no primeiro erro.
 * - O cancelamento do serviço impede callbacks após a desmontagem; callbacks de sessões antigas são ignorados.
 */

export type EstadoFonte = 'carregando' | 'pronto' | 'erro';

export interface FonteObservada<T> {
  /** Dados recebidos nesta sessão; `undefined` enquanto nenhuma resposta válida chegou. */
  dados: T | undefined;
  estado: EstadoFonte;
  erro: FirestoreError | null;
  /** Já houve resposta válida nesta sessão (mesmo que vazia). */
  recebido: boolean;
  /** Em erro, mas ainda com dados recebidos antes dele. */
  desatualizado: boolean;
  /** Momento em que os últimos dados chegaram ao app. */
  recebidoEmMs: number;
  tentarNovamente: () => void;
}

type Assinar<T> = (
  dispositivoId: string,
  onDados: (dados: T) => void,
  onErro: (erro: FirestoreError) => void
) => () => void;

const assinarUltimaLeitura: Assinar<Leitura | null> = (id, onDados, onErro) =>
  observarUltimaLeitura(onDados, id, onErro);
const assinarHistorico: Assinar<Leitura[]> = (id, onDados, onErro) =>
  observarHistorico(onDados, null, id, onErro);
const assinarHistoricoDiario: Assinar<ConsumoDiario[]> = (id, onDados, onErro) =>
  observarHistoricoDiario(onDados, id, undefined, onErro);

/** Identificador de sessão que muda a cada troca de usuário ou central. */
function useSessaoCentral(usuarioId: string | undefined, dispositivoId: string): number {
  const chave = `${usuarioId ?? ''}::${dispositivoId}`;
  // Ajuste de estado durante a renderização (sem setState em useEffect):
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [sessao, setSessao] = useState({ chave, id: 0 });
  if (sessao.chave !== chave) {
    const nova = { chave, id: sessao.id + 1 };
    setSessao(nova);
    return nova.id;
  }
  return sessao.id;
}

function useFonte<T>(assinar: Assinar<T>, sessaoId: number, dispositivoId: string): FonteObservada<T> {
  const [tentativa, setTentativa] = useState(0);
  const [recebido, setRecebido] = useState<{ sessao: number; dados: T; em: number } | null>(null);
  const [falha, setFalha] = useState<{ sessao: number; tentativa: number; erro: FirestoreError } | null>(null);

  useEffect(() => {
    return assinar(
      dispositivoId,
      (dados) => setRecebido({ sessao: sessaoId, dados, em: Date.now() }),
      (erro) => setFalha({ sessao: sessaoId, tentativa, erro })
    );
  }, [assinar, sessaoId, tentativa, dispositivoId]);

  const valido = recebido?.sessao === sessaoId ? recebido : null;
  const erro = falha?.sessao === sessaoId && falha.tentativa === tentativa ? falha.erro : null;

  return {
    dados: valido?.dados,
    estado: erro ? 'erro' : valido ? 'pronto' : 'carregando',
    erro,
    recebido: valido !== null,
    desatualizado: erro !== null && valido !== null,
    recebidoEmMs: valido?.em ?? 0,
    tentarNovamente: () => setTentativa((t) => t + 1),
  };
}

/** Disponibilidade de um indicador que depende de uma ou mais fontes. */
export type Disponibilidade = 'ok' | 'desatualizado' | 'carregando' | 'indisponivel';

export function disponibilidade(...fontes: FonteObservada<unknown>[]): Disponibilidade {
  if (fontes.some((f) => f.estado === 'erro' && !f.recebido)) return 'indisponivel';
  if (fontes.some((f) => f.estado === 'carregando')) return 'carregando';
  if (fontes.some((f) => f.desatualizado)) return 'desatualizado';
  return 'ok';
}

/** O indicador pode ser exibido (atual ou marcado como desatualizado). */
export const exibivel = (d: Disponibilidade) => d === 'ok' || d === 'desatualizado';

export interface FonteRotulada {
  rotulo: string;
  fonte: FonteObservada<unknown>;
}

/** Última leitura, histórico bruto e histórico diário da central do usuário. */
export function useLeiturasCentral(usuarioId: string | undefined, dispositivoId: string) {
  const sessaoId = useSessaoCentral(usuarioId, dispositivoId);
  const ultima = useFonte(assinarUltimaLeitura, sessaoId, dispositivoId);
  const bruto = useFonte(assinarHistorico, sessaoId, dispositivoId);
  const diario = useFonte(assinarHistoricoDiario, sessaoId, dispositivoId);

  const fontes: FonteRotulada[] = [
    { rotulo: 'medição em tempo real', fonte: ultima },
    { rotulo: 'histórico de leituras', fonte: bruto },
    { rotulo: 'histórico diário', fonte: diario },
  ];

  return {
    ultima,
    bruto,
    diario,
    fontes,
    leitura: ultima.dados ?? null,
    historico: bruto.dados ?? [],
    historicoDiario: diario.dados ?? [],
    tentarNovamente: () => fontes.forEach(({ fonte }) => { if (fonte.estado === 'erro') fonte.tentarNovamente(); }),
  };
}

export type EstadoLeiturasCentral = ReturnType<typeof useLeiturasCentral>;

/** Somente o histórico bruto (usado em Metas). */
export function useHistoricoCentral(usuarioId: string | undefined, dispositivoId: string) {
  const sessaoId = useSessaoCentral(usuarioId, dispositivoId);
  const bruto = useFonte(assinarHistorico, sessaoId, dispositivoId);
  return {
    bruto,
    fontes: [{ rotulo: 'histórico de leituras', fonte: bruto }] as FonteRotulada[],
    tentarNovamente: () => { if (bruto.estado === 'erro') bruto.tentarNovamente(); },
  };
}

/** Mensagem amigável para o usuário final; nunca exibe a mensagem técnica do Firestore. */
export function mensagemErroLeituras(erro: FirestoreError | null): string {
  switch (erro?.code) {
    case 'permission-denied':
      return 'Sua conta não tem permissão para acessar as leituras desta central.';
    case 'unauthenticated':
      return 'Sua sessão expirou. Entre novamente para ver as leituras.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Não foi possível conectar ao servidor. Verifique sua internet.';
    case 'resource-exhausted':
      return 'O limite de consultas foi atingido. Tente novamente mais tarde.';
    default:
      return 'Não foi possível carregar as leituras no momento.';
  }
}
