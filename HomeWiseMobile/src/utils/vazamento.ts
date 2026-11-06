import type { Leitura } from '@/services/leiturasService';

/** Vazão mínima (L/min) considerada fluxo ativo para análise de continuidade. */
export const LIMIAR_VAZAO_CONTINUA_L_MIN = 1.5;

/** Quantidade mínima de leituras consecutivas com fluxo ativo para sinalizar consumo contínuo (RF19). */
export const MIN_LEITURAS_FLUXO_CONTINUO = 3;

/**
 * Identifica períodos de fluxo contínuo de água (RF19) a partir da sequência de leituras,
 * sem apresentar o aviso como comprovação definitiva de vazamento.
 *
 * Critérios:
 * 1. Sequência prolongada: pelo menos `MIN_LEITURAS_FLUXO_CONTINUO` leituras consecutivas mais recentes
 *    com vazão >= `LIMIAR_VAZAO_CONTINUA_L_MIN` (1,5 L/min), enquanto a leitura atual mantém fluxo ativo; OU
 * 2. Fluxo intenso com volume diário acumulado elevado (vazão > 5,0 L/min e acumulado > 50 L).
 */
export function detectarFluxoContinuoAgua(
  leituraAtual: Leitura | null,
  historico: Leitura[] = [],
  minLeiturasConsecutivas: number = MIN_LEITURAS_FLUXO_CONTINUO
): boolean {
  if (!leituraAtual) return false;

  const vazaoAtual = Number(leituraAtual.vazao_l_min || 0);
  const volumeAtual = Number(leituraAtual.consumo_agua_litros || 0);

  if (vazaoAtual <= 0) return false;

  // Critério de fluxo agudo elevado com alto volume acumulado
  if (vazaoAtual > 5.0 && volumeAtual > 50) {
    return true;
  }

  // Unifica histórico e leitura atual sem duplicar a mesma medição
  const mapa = new Map<string, Leitura>();
  for (const item of historico) {
    if (!item) continue;
    const chave = item.id || String(item.criado_em ? new Date(item.criado_em).getTime() : Math.random());
    mapa.set(chave, item);
  }
  const chaveAtual = leituraAtual.id || String(leituraAtual.criado_em ? new Date(leituraAtual.criado_em).getTime() : 'atual');
  mapa.set(chaveAtual, leituraAtual);

  const sequencia = Array.from(mapa.values()).sort((a, b) => {
    const tA = a.criado_em ? new Date(a.criado_em).getTime() : 0;
    const tB = b.criado_em ? new Date(b.criado_em).getTime() : 0;
    return tA - tB;
  });

  if (sequencia.length < minLeiturasConsecutivas) {
    return false;
  }

  const ultimas = sequencia.slice(-minLeiturasConsecutivas);
  return ultimas.every((item) => Number(item.vazao_l_min || 0) >= LIMIAR_VAZAO_CONTINUA_L_MIN);
}

