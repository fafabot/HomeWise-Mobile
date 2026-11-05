/**
 * Identidade visual experimental do HomeWise (branch experiment/visual-inicio).
 * Somente apresentação: cores, raios, espaçamentos e tipografia compartilhados pelas telas.
 */
export const C = {
  fundo: '#07131b',
  fundoProfundo: '#050e14',
  superficie: '#0b1c27',
  superficieAlta: '#0f2431',
  superficieHover: '#132c3b',
  borda: '#173244',
  bordaSuave: '#122a39',
  bordaForte: '#21465c',
  texto: '#f1f7fa',
  textoSec: '#9db1bd',
  textoTer: '#7f97a6',
  marca: '#22b7d4',
  marcaForte: '#0a7d96',
  agua: '#38bdf8',
  energia: '#4ade80',
  ok: '#22c55e',
  alerta: '#f59e0b',
  perigo: '#f87171',
  perigoFundo: '#261414',
  perigoBorda: '#7f1d1d'
} as const;

/** Cor translúcida a partir de um hex de 6 dígitos (ex.: alfa('#22b7d4', 0.12)). */
export function alfa(hex: string, opacidade: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacidade})`;
}

export const RAIO = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 } as const;

export const LARGURA_MAXIMA = 720;

export const NUMEROS = { fontVariant: ['tabular-nums' as const] };

export const T = {
  titulo: { color: C.texto, fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.6 },
  tituloSecao: { color: C.texto, fontSize: 16, fontWeight: '700' as const },
  etiqueta: { color: C.textoTer, fontSize: 10.5, fontWeight: '700' as const, letterSpacing: 1.1 },
  corpo: { color: C.textoSec, fontSize: 13, lineHeight: 19 },
  legenda: { color: C.textoTer, fontSize: 11.5 }
};
