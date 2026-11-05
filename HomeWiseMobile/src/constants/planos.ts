export const planos = [
  {
    id: 'basico',
    nome: 'Básico',
    descricao: 'Para começar a monitorar',
    preco: '19,90',
    precoAnual: '16,90',
    totalAnual: '202,80',
    icone: 'home-outline',
    beneficios: [
      'Monitoramento em tempo real (1 central inclusa)',
      'Alertas inteligentes de vazamento e pico',
      'Relatórios básicos (diário e semanal)',
      '1 residência vinculada',
    ],
  },
  {
    id: 'plus',
    nome: 'Plus',
    descricao: 'Mais controle e metas',
    preco: '29,90',
    precoAnual: '25,40',
    totalAnual: '304,80',
    icone: 'layers-outline',
    beneficios: [
      'Tudo do plano Básico',
      'Relatórios completos (mensal e anual)',
      'Metas mensais de economia',
      'Comparativo e linha de base de consumo',
      'Até 3 residências vinculadas',
    ],
  },
  {
    id: 'premium',
    nome: 'Premium',
    descricao: 'Experiência completa',
    preco: '49,90',
    precoAnual: '42,40',
    totalAnual: '508,80',
    icone: 'diamond-outline',
    beneficios: [
      'Tudo do plano Plus',
      'Múltiplas centrais e sensores por residência',
      'Automação e diagnóstico avançado de rede',
      'Suporte técnico prioritário',
      'Residências ilimitadas',
    ],
  },
] as const;

export type Plano = (typeof planos)[number];
export type PlanoId = Plano['id'];
export type CicloAssinatura = 'mensal' | 'anual';

export function obterPlanoPorId(id?: string | null): Plano | null {
  if (!id) return null;
  const normalizado = id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return planos.find(p => p.id === normalizado) ?? null;
}

export function temPlanoAtivo(planoId?: string | null, status?: string | null): boolean {
  if (!planoId || status === 'cancelada' || status === 'inativa') return false;
  return obterPlanoPorId(planoId) !== null;
}

export function temAcessoPlus(planoId?: string | null, status?: string | null): boolean {
  if (!temPlanoAtivo(planoId, status)) return false;
  const plano = obterPlanoPorId(planoId);
  return plano?.id === 'plus' || plano?.id === 'premium';
}

export function temAcessoPremium(planoId?: string | null, status?: string | null): boolean {
  if (!temPlanoAtivo(planoId, status)) return false;
  const plano = obterPlanoPorId(planoId);
  return plano?.id === 'premium';
}
