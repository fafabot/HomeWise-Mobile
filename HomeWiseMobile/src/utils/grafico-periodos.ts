import type { Leitura } from '@/services/leiturasService';

export type PeriodoGrafico = 'dia' | 'semana' | 'mes' | 'ano';

export interface ResumoDiarioMinimo {
  data: string; // Formato YYYY-MM-DD
  consumo_agua_litros: number;
  energia_kwh: number;
}

export function obterRotuloConsumoPorPeriodo(periodo: PeriodoGrafico): string {
  switch (periodo) {
    case 'dia':
      return 'Consumo medido hoje';
    case 'semana':
      return 'Consumo medido na semana';
    case 'mes':
      return 'Consumo medido no mês';
    case 'ano':
      return 'Consumo medido no ano';
  }
}

function obterIntervaloPeriodoAtual(periodo: PeriodoGrafico, agora: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodo === 'semana') {
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  } else if (periodo === 'mes') {
    inicio.setDate(1);
  } else if (periodo === 'ano') {
    inicio.setMonth(0, 1);
  }

  const fim = new Date(inicio);
  if (periodo === 'dia') {
    fim.setDate(fim.getDate() + 1);
  } else if (periodo === 'semana') {
    fim.setDate(fim.getDate() + 7);
  } else if (periodo === 'mes') {
    fim.setMonth(fim.getMonth() + 1);
  } else if (periodo === 'ano') {
    fim.setFullYear(fim.getFullYear() + 1);
  }

  return { inicio, fim };
}

function formatarChaveDataLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Calcula o consumo real acumulado dentro do período selecionado ('dia' | 'semana' | 'mes' | 'ano').
 * Como o ESP8266 envia contadores acumulados por dia em cada leitura, considera o maior valor
 * consolidado de cada dia (YYYY-MM-DD) dentro do intervalo e soma os dias do período.
 */
export function calcularConsumoPorPeriodo(
  leituras: Leitura[],
  periodo: PeriodoGrafico,
  campo: 'consumo_agua_litros' | 'energia_kwh',
  historicoDiario: ResumoDiarioMinimo[] = [],
  agora = new Date()
): number {
  const { inicio, fim } = obterIntervaloPeriodoAtual(periodo, agora);
  const diarios = new Map<string, number>();

  for (const item of historicoDiario) {
    if (!item?.data) continue;
    const partes = item.data.split('-').map(Number);
    if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) continue;
    const dataLocal = new Date(partes[0], partes[1] - 1, partes[2]);
    if (dataLocal < inicio || dataLocal >= fim || dataLocal > agora) continue;

    const valor = Number(item[campo]);
    if (!Number.isFinite(valor) || valor < 0) continue;
    diarios.set(item.data, Math.max(diarios.get(item.data) ?? 0, valor));
  }

  for (const leitura of leituras) {
    if (!leitura?.criado_em) continue;
    const data = new Date(leitura.criado_em);
    const ts = data.getTime();
    if (!Number.isFinite(ts) || ts <= 0) continue;
    if (data < inicio || data >= fim || data > agora) continue;

    const valor = Number(leitura[campo]);
    if (!Number.isFinite(valor) || valor < 0) continue;
    const chaveDia = formatarChaveDataLocal(data);
    diarios.set(chaveDia, Math.max(diarios.get(chaveDia) ?? 0, valor));
  }

  let total = 0;
  for (const valorDia of diarios.values()) {
    total += valorDia;
  }
  return total;
}

export function montarBarrasPorPeriodo(
  historico: Leitura[],
  periodo: PeriodoGrafico,
  campo: 'vazao_l_min' | 'potencia_w',
  agora = new Date(),
) {
  const quantidade = { dia: 3, semana: 3, mes: 6, ano: 5 }[periodo];
  const inicioAtual = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodo === 'semana') inicioAtual.setDate(inicioAtual.getDate() - (inicioAtual.getDay() + 6) % 7);
  if (periodo === 'mes') inicioAtual.setDate(1);
  if (periodo === 'ano') inicioAtual.setMonth(0, 1);

  function deslocar(data: Date, passos: number) {
    const resultado = new Date(data);
    if (periodo === 'dia') resultado.setDate(resultado.getDate() + passos);
    if (periodo === 'semana') resultado.setDate(resultado.getDate() + passos * 7);
    if (periodo === 'mes') resultado.setMonth(resultado.getMonth() + passos);
    if (periodo === 'ano') resultado.setFullYear(resultado.getFullYear() + passos);
    return resultado;
  }

  return Array.from({ length: quantidade }, (_, indice) => {
    const distancia = quantidade - 1 - indice;
    const inicio = deslocar(inicioAtual, -distancia);
    const fim = deslocar(inicio, 1);
    const amostras = historico.filter(item => {
      if (!item.criado_em || !Number.isFinite(item[campo])) return false;
      const data = new Date(item.criado_em);
      return data >= inicio && data < fim && data <= agora;
    });
    const label = periodo === 'dia' ? ['Hoje', 'Ontem', 'Anteontem'][distancia]
      : periodo === 'semana' ? ['Esta semana', 'Semana passada', 'Há 2 semanas'][distancia]
      : periodo === 'mes' ? inicio.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      : String(inicio.getFullYear());
    return {
      label,
      valor: amostras.length ? amostras.reduce((total, item) => total + item[campo], 0) / amostras.length : null,
    };
  });
}
