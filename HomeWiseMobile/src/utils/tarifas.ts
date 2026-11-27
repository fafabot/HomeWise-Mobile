/**
 * Cálculo tarifário residencial real — Região do Alto Tietê / Poá e Suzano (SP) — Vigência Nov/2026:
 *
 * 1. Água e Esgoto — Sabesp (URAE-1 / RMSP, Comunicado Tarifário jan/2026, Residencial Normal):
 *    - Até 10 m³ (10.000 L): tarifa mínima fixa de R$ 40,42 (água) + R$ 40,42 (esgoto 100%) = R$ 80,84.
 *    - De 11 a 20 m³: R$ 6,40/m³ (água) + R$ 6,40/m³ (esgoto) = R$ 12,80 por m³ excedente.
 *    - De 21 a 50 m³: R$ 15,96/m³ (água) + R$ 15,96/m³ (esgoto) = R$ 31,92 por m³ excedente.
 *    - Acima de 50 m³: R$ 17,60/m³ (água) + R$ 17,60/m³ (esgoto) = R$ 35,20 por m³ excedente.
 *
 * 2. Energia Elétrica — EDP São Paulo (ANEEL REH nº 3.611/2026, Subgrupo B1 Residencial Convencional):
 *    - Tarifa base (TUSD + TE sem tributos): R$ 0,802/kWh.
 *    - Bandeira tarifária vigente (nov/2026): Verde (+R$ 0,00/kWh).
 *    - Tributos ("cálculo por dentro"): PIS/COFINS (~6,0%) + ICMS-SP progressivo (RICMS/SP):
 *        • Até 90 kWh: isento de ICMS (0%)
 *        • De 91 a 200 kWh: 12% de ICMS (~R$ 0,978/kWh efetivo)
 *        • Acima de 200 kWh: 18% de ICMS (~R$ 1,055/kWh efetivo)
 *    - CIP (Contribuição de Iluminação Pública Municipal — média residencial Poá/SP): R$ 16,00 (acima de 30 kWh).
 */

export const SABESP_MINIMO_AGUA_ATE_10M3 = 40.42;
export const SABESP_MINIMO_ESGOTO_ATE_10M3 = 40.42;
export const SABESP_MINIMO_TOTAL_ATE_10M3 =
  SABESP_MINIMO_AGUA_ATE_10M3 + SABESP_MINIMO_ESGOTO_ATE_10M3; // R$ 80,84

export const EDP_TARIFA_BASE_KWH = 0.802;
export const EDP_ADICIONAL_BANDEIRA_KWH = 0.0; // Bandeira Verde (nov/2026)
export const ALIQUOTA_PIS_COFINS = 0.06;
export const CIP_RESIDENCIAL_PADRAO = 16.0;

/**
 * Calcula a fatura mensal estimada de água + esgoto (Sabesp Residencial Normal — Poá/Suzano/RMSP).
 */
export function calcularFaturaSabespMensal(consumoLitros: number): number {
  if (!Number.isFinite(consumoLitros) || consumoLitros <= 0) return 0;

  const m3 = consumoLitros / 1000;
  if (m3 <= 10) {
    return SABESP_MINIMO_TOTAL_ATE_10M3;
  }

  let total = SABESP_MINIMO_TOTAL_ATE_10M3;

  // Faixa 2: > 10 m³ até 20 m³ (R$ 6,40 água + R$ 6,40 esgoto = R$ 12,80/m³)
  const faixa11a20 = Math.min(m3, 20) - 10;
  if (faixa11a20 > 0) {
    total += faixa11a20 * 12.8;
  }

  // Faixa 3: > 20 m³ até 50 m³
  if (m3 > 20) {
    const faixa21a50 = Math.min(m3, 50) - 20;
    total += faixa21a50 * 31.92;
  }

  // Faixa 4: > 50 m³
  if (m3 > 50) {
    total += (m3 - 50) * 35.2;
  }

  return total;
}

/**
 * Retorna a alíquota de ICMS residencial do Estado de São Paulo (RICMS/SP) conforme a faixa mensal.
 */
export function obterAliquotaIcmsEnergiaSp(consumoMensalKwh: number): number {
  if (consumoMensalKwh <= 90) return 0;
  if (consumoMensalKwh <= 200) return 0.12;
  return 0.18;
}

/**
 * Calcula a fatura mensal estimada de energia elétrica (EDP São Paulo B1 Residencial + ICMS/PIS/COFINS + CIP).
 */
export function calcularFaturaEdpMensal(consumoKwh: number): number {
  if (!Number.isFinite(consumoKwh) || consumoKwh <= 0) return 0;

  const icms = obterAliquotaIcmsEnergiaSp(consumoKwh);
  const cargaTributaria = icms + ALIQUOTA_PIS_COFINS;
  const tarifaEfetivaKwh =
    (EDP_TARIFA_BASE_KWH + EDP_ADICIONAL_BANDEIRA_KWH) / (1 - cargaTributaria);

  const valorConsumo = consumoKwh * tarifaEfetivaKwh;
  const cip = consumoKwh > 30 ? CIP_RESIDENCIAL_PADRAO : 0;

  return valorConsumo + cip;
}

export interface ResumoFinanceiroResidencial {
  custoAguaPrevistoMes: number;
  custoEnergiaPrevistoMes: number;
  custoTotalPrevistoMes: number;
  custoAguaHoje: number;
  custoEnergiaHoje: number;
  custoTotalHoje: number;
  custoAcumuladoMes: number;
  custoMedioDiaAprendido: number;
}

/**
 * Consolida a previsão mensal pelas regras reais da Sabesp + EDP SP e rateia o custo unitário efetivo
 * do ciclo atual para os indicadores de gasto hoje, acumulado no mês e média diária aprendida.
 */
export function calcularResumoFinanceiroResidencial(params: {
  aguaHojeLitros: number;
  energiaHojeKwh: number;
  aguaAcumuladaMesLitros: number;
  energiaAcumuladaMesKwh: number;
  mediaAguaDiaLitros: number;
  mediaEnergiaDiaKwh: number;
  aguaPrevistaMesLitros: number;
  energiaPrevistaMesKwh: number;
}): ResumoFinanceiroResidencial {
  const {
    aguaHojeLitros,
    energiaHojeKwh,
    aguaAcumuladaMesLitros,
    energiaAcumuladaMesKwh,
    mediaAguaDiaLitros,
    mediaEnergiaDiaKwh,
    aguaPrevistaMesLitros,
    energiaPrevistaMesKwh
  } = params;

  const custoAguaPrevistoMes = calcularFaturaSabespMensal(aguaPrevistaMesLitros);
  const custoEnergiaPrevistoMes = calcularFaturaEdpMensal(energiaPrevistaMesKwh);
  const custoTotalPrevistoMes = custoAguaPrevistoMes + custoEnergiaPrevistoMes;

  const taxaEfetivaAguaPorLitro =
    aguaPrevistaMesLitros > 0 ? custoAguaPrevistoMes / aguaPrevistaMesLitros : 0;
  const taxaEfetivaEnergiaPorKwh =
    energiaPrevistaMesKwh > 0 ? custoEnergiaPrevistoMes / energiaPrevistaMesKwh : 0;

  const custoAguaHoje = Math.max(aguaHojeLitros, 0) * taxaEfetivaAguaPorLitro;
  const custoEnergiaHoje = Math.max(energiaHojeKwh, 0) * taxaEfetivaEnergiaPorKwh;
  const custoTotalHoje = custoAguaHoje + custoEnergiaHoje;

  const custoAcumuladoMes =
    Math.max(aguaAcumuladaMesLitros, 0) * taxaEfetivaAguaPorLitro +
    Math.max(energiaAcumuladaMesKwh, 0) * taxaEfetivaEnergiaPorKwh;

  const custoMedioDiaAprendido =
    Math.max(mediaAguaDiaLitros, 0) * taxaEfetivaAguaPorLitro +
    Math.max(mediaEnergiaDiaKwh, 0) * taxaEfetivaEnergiaPorKwh;

  return {
    custoAguaPrevistoMes,
    custoEnergiaPrevistoMes,
    custoTotalPrevistoMes,
    custoAguaHoje,
    custoEnergiaHoje,
    custoTotalHoje,
    custoAcumuladoMes,
    custoMedioDiaAprendido
  };
}
