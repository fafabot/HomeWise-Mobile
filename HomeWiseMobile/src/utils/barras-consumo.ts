import type { Leitura } from '@/services/leiturasService';
import { calcularConsumoPorPeriodo, type PeriodoGrafico, type ResumoDiarioMinimo } from '@/utils/grafico-periodos';

export interface BarraConsumo {
  label: string;
  /** Consumo do período; null quando não há nenhuma leitura no período (diferente de zero medido). */
  valor: number | null;
}

const QUANTIDADE: Record<PeriodoGrafico, number> = { dia: 3, semana: 3, mes: 6, ano: 5 };

function inicioDoPeriodoAtual(periodo: PeriodoGrafico, agora: Date) {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodo === 'semana') inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  if (periodo === 'mes') inicio.setDate(1);
  if (periodo === 'ano') inicio.setMonth(0, 1);
  return inicio;
}

function deslocar(periodo: PeriodoGrafico, data: Date, passos: number) {
  const resultado = new Date(data);
  if (periodo === 'dia') resultado.setDate(resultado.getDate() + passos);
  if (periodo === 'semana') resultado.setDate(resultado.getDate() + passos * 7);
  if (periodo === 'mes') resultado.setMonth(resultado.getMonth() + passos);
  if (periodo === 'ano') resultado.setFullYear(resultado.getFullYear() + passos);
  return resultado;
}

function rotulo(periodo: PeriodoGrafico, inicio: Date, distancia: number) {
  if (periodo === 'dia') return ['Hoje', 'Ontem', 'Anteontem'][distancia];
  if (periodo === 'semana') return ['Esta semana', 'Semana passada', 'Há 2 semanas'][distancia];
  if (periodo === 'mes') return inicio.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return String(inicio.getFullYear());
}

/** Há alguma leitura (bruta ou resumo diário) do campo dentro de [inicio, fim) até `agora`? */
function temLeituraNoIntervalo(
  leituras: Leitura[],
  historicoDiario: ResumoDiarioMinimo[],
  campo: 'consumo_agua_litros' | 'energia_kwh',
  inicio: Date,
  fim: Date,
  agora: Date
) {
  const dentro = (data: Date) => data >= inicio && data < fim && data <= agora;
  const existeLeitura = leituras.some((l) => {
    if (!l?.criado_em || !Number.isFinite(Number(l[campo]))) return false;
    const data = new Date(l.criado_em);
    return Number.isFinite(data.getTime()) && dentro(data);
  });
  if (existeLeitura) return true;
  return historicoDiario.some((d) => {
    const partes = d?.data?.split('-').map(Number);
    if (!partes || partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return false;
    return Number.isFinite(Number(d[campo])) && dentro(new Date(partes[0], partes[1] - 1, partes[2]));
  });
}

/**
 * Consumo por período para o gráfico (mesmos períodos e rótulos do gráfico de barras existente).
 * Cada barra usa a função existente calcularConsumoPorPeriodo, sem alterar a fórmula: para períodos
 * passados, o "agora" passado à função é o último instante daquele período; para o atual, o agora real.
 * Assim a barra do período atual é igual ao consumo exibido no cartão principal.
 */
export function montarBarrasConsumo(
  leituras: Leitura[],
  historicoDiario: ResumoDiarioMinimo[],
  periodo: PeriodoGrafico,
  campo: 'consumo_agua_litros' | 'energia_kwh',
  agora = new Date()
): BarraConsumo[] {
  const quantidade = QUANTIDADE[periodo];
  const inicioAtual = inicioDoPeriodoAtual(periodo, agora);
  return Array.from({ length: quantidade }, (_, indice) => {
    const distancia = quantidade - 1 - indice;
    const inicio = deslocar(periodo, inicioAtual, -distancia);
    const fim = deslocar(periodo, inicio, 1);
    const referencia = distancia === 0 ? agora : new Date(fim.getTime() - 1);
    const valor = temLeituraNoIntervalo(leituras, historicoDiario, campo, inicio, fim, referencia)
      ? calcularConsumoPorPeriodo(leituras, periodo, campo, historicoDiario, referencia)
      : null;
    return { label: rotulo(periodo, inicio, distancia), valor };
  });
}
