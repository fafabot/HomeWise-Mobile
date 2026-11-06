# Integração dos gráficos com a main — 05/11/2026

## Histórico preservado

A branch `feat/graficos-agua-padrao-energia` mantém o commit
`dd1ba5e6470cc06e16e6a0a00d7e313a750dd34f`, incluindo sua autoria e coautoria.
Após `git fetch --all --prune`, a main remota consultada estava em
`b032d56f16971695c109c34786f74c54ef52dc33`.

Essa main foi incorporada por merge na branch dos gráficos, sem rebase ou force push.
O commit `b032d56` atualiza Firebase para `^13.2.0` e o lockfile; ambos foram mantidos.
Não houve conflito textual. Os serviços, contratos, controles de acesso por plano,
tratamento de erros e ajustes visuais anteriores permanecem preservados.
Atualizações em outras branches ainda não incorporadas à main não integram este PR.

## Métricas e interação

- **Água:** o gráfico mostra consumo por período em **litros (L)**, usando os históricos
  bruto e diário e a função de consumo existente. O período atual segue o mesmo
  cálculo do cartão de total. Vazão instantânea em L/min permanece separada.
- **Energia:** o gráfico continua mostrando **potência média em watts (W)** calculada
  das amostras brutas. Não representa energia consumida em kWh; o cartão de consumo
  continua com sua unidade própria.
- **Ambas:** selecionar uma barra abre detalhes do período, métrica, valor e unidade,
  com indicação de desatualização quando aplicável. É possível fechar pelo mesmo
  item, botão de fechar, toque fora, Escape na web ou troca de período.
- Zero medido e período sem leituras são distintos; valores positivos pequenos
  não são apresentados como zero. Mantêm-se os limites de acesso por plano e a
  indisponibilidade do gráfico de Água quando faltar uma fonte necessária.

## Verificações e limites

As verificações da integração abrangem tipos, lint, `npm test` e exportação web.
Resultado: tipos e lint aprovados, 79 testes aprovados e build web concluído. O Metro
recuperou um cache incompatível por reconstrução completa, sem falha da exportação.
As dependências locais são instaladas a partir do lockfile integrado para validar
com Firebase 13.2.0, em vez da instalação anterior 13.0.0.

Os testes dos cálculos usam datas e leituras sintéticas. Os testes de componentes
substituem Auth, serviços e elementos nativos. Comprovam apenas os cenários locais
de cálculo e interação cobertos: não homologam dados de sensores reais, regras e
índices do Firebase, concorrência, gestos no aparelho ou todos os navegadores.
Build web bem-sucedido também não comprova o funcionamento com produção.

O checkout permanece uma simulação; Firebase real, pagamentos e câmera continuam
pendentes de homologação. Não foram alteradas regras implantadas, dados reais ou
configurações de produção. Este trabalho publica a branch e abre PR para revisão;
não realiza merge na main.
