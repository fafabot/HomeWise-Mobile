export const planos = [
  {
    id: 'basico', nome: 'Básico', descricao: 'Para começar', preco: '19,90', icone: 'home-outline',
    beneficios: ['Monitoramento em tempo real', 'Alertas inteligentes', 'Relatórios básicos', '1 residência'],
  },
  {
    id: 'plus', nome: 'Plus', descricao: 'Mais controle', preco: '29,90', icone: 'layers-outline',
    beneficios: ['Tudo do plano básico', 'Relatórios completos', 'Metas de economia', 'Até 3 residências', 'Comparativo de consumo'],
  },
  {
    id: 'premium', nome: 'Premium', descricao: 'Experiência completa', preco: '49,90', icone: 'diamond-outline',
    beneficios: ['Tudo do plano plus', 'Integração com dispositivos', 'Suporte prioritário', 'Residências ilimitadas'],
  },
] as const;

export type Plano = (typeof planos)[number];
