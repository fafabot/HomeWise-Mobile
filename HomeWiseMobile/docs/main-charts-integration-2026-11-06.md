# Integração dos gráficos aprovados na main — 06/11/2026

## Escopo e histórico

Revisão das worktrees, branches e PRs seguida de fetch. A main remota avançou de
`b032d56` para `afca1a473078d0804b64de3e87cc09cc8f5a9f56`. A integração preserva
o commit do Firebase 13.2.0/lockfile e as mudanças posteriores do colega em
gerenciar-assinatura.tsx, AuthContext.tsx e authService.ts.

Os PRs #1 (base funcional) e #2 (visual aprovado) já estavam na main. O PR #3 é a
única integração de funcionalidade pendente selecionada: mantém `dd1ba5e` e
`766de10`, suas autorias, contratos, visual, acessibilidade e testes. A combinação
com a main atual não apresentou conflitos textuais. Nenhum arquivo de assinatura
ou dependência foi revertido para a versão antiga da branch dos gráficos.

Não foram selecionadas mudanças adicionais de matheus/ayran, experimentos antigos
nem qualquer arquivo da branch/worktree docs/telemetria-v2-contract. A telemetria v2
permanece separada, pausada e sem commit. Backup recuperável externo contém bundle
do histórico, manifesto, patches e cópias de alterações locais verificadas por hash;
backups e builds não fazem parte do PR.

## Ajustes de compatibilidade

- O teste de confirmação de pagamento usa cadastro completo sintético compatível
  com as validações atuais da main. Confere que endereço e método chegam ao mock de
  ativação e mantém a verificação dos cinco segundos da confirmação.
- Teste adicional comprova que cadastro incompleto não ativa plano. Nenhuma chamada
  real a serviço de CEP, Firebase ou pagamento é feita pelos testes.
- src/types/expo.d.ts referencia tipos Expo para CSS e globais web em checkout novo,
  mesmo antes da geração do expo-env.d.ts ignorado. Sem código de execução.

## Verificação da integração

Dependências instaladas pelo lockfile com npm ci; versão instalada de Firebase 13.2.0.

```powershell
npm ci --no-audit --no-fund
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm run lint -- --no-cache
npm test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist
```

Tipos, lint, 80 testes e exportação web aprovados antes da publicação. O build é
somente local: não corresponde a deploy. react-test-renderer emite avisos de
depreciação sem falha nos testes.

Água apresenta consumo por período em L; Energia apresenta potência média em W.
Os detalhes de barras são cobertos por testes de componente e serão conferidos
também no navegador da pasta principal após sua atualização, com estado sintético
restrito à sessão de teste e requisições externas bloqueadas. Essa inspeção não
altera código/configuração do app nem grava leituras ou consolidados reais.

## Limites

Não homologa sensores, contadores legados, índices/regras, autenticação ou pagamentos
de produção. Cálculos v2 não foram incorporados. Regras, dados e firmware não foram
alterados. O checkout continua simulação acadêmica. Publicação usa push normal e PR,
sem force push, rebase, remoção de branches ou substituição de alterações locais.
