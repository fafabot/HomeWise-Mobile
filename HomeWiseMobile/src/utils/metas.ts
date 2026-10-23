import type { Leitura } from '@/services/leiturasService';

export function resumirConsumoMensal(leituras: Leitura[], campo: 'consumo_agua_litros' | 'energia_kwh', agora = new Date()) {
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diarios: (number | null)[] = Array.from({ length: diasNoMes }, () => null);
  for (const leitura of leituras) {
    if (!leitura.criado_em) continue;
    const data = new Date(leitura.criado_em);
    const valor = leitura[campo];
    if (data > agora || data.getFullYear() !== agora.getFullYear() || data.getMonth() !== agora.getMonth() || !Number.isFinite(valor) || valor < 0) continue;
    const indice = data.getDate() - 1;
    // The dashboard exposes daily accumulated counters: repeated samples must not be summed.
    diarios[indice] = Math.max(diarios[indice] ?? 0, valor);
  }
  let total = 0;
  const pontos = diarios.slice(0, agora.getDate()).map((valor, indice) => {
    total += valor ?? 0;
    return { dia: indice + 1, valor: total, medido: valor !== null };
  });
  return { total, pontos, diasNoMes, diasComLeituras: diarios.filter(valor => valor !== null).length };
}

export function lerMeta(texto: string): number | null {
  const normalizado = texto.trim().replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalizado)) return null;
  const valor = Number(normalizado.replace(',', '.'));
  return Number.isFinite(valor) && valor > 0 && valor <= 1_000_000_000 ? valor : null;
}