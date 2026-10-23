import type { Leitura } from '@/services/leiturasService';

export type PeriodoGrafico = 'dia' | 'semana' | 'mes' | 'ano';

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