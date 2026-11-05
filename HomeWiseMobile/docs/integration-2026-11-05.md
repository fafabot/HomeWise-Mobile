# Integração de 05/11/2026

## Origem e preservação

- Base local: `1311b8d7071a55d7fae607b14f038bd18109a26f`.
- `git fetch --all --prune` confirmou `origin/main` em
  `ec653239725cb4cf0541f489300655267874f1e8`, de fafabot.
- Esse era o único commit remoto ainda fora da main local. `origin/matheus`
  estava na base local e já estava contida na main remota; não foi reintegrada.
- O commit remoto é incorporado por merge, preservando seu hash e autoria.
- Alterações locais de interface, serviços, contratos e testes foram registradas
  em três commits temáticos antes do merge. A identidade desses novos commits é a
  identidade Git configurada no checkout, sem atribuir autoria fictícia aos colegas.
- Antes de criar a branch, foi produzida e verificada uma cópia externa do checkout,
  com `.git`, alterações locais e não rastreados, incluindo configuração gerada do Expo.
  Somente `node_modules` foi excluído, por ser reinstalável pelo lockfile.
- Não houve push, deploy, alteração de regras/dados reais ou avanço da main local.

## Decisões de integração

- Água e Energia: unificar `user`, `perfil` e `dispositivoId` do AuthContext;
  manter uma única fonte de leituras pelo hook local, com falhas separadas e retry
  explícito. Preservar os controles publicados de acesso Plus para mês/ano.
  Não restaurar listeners e estados duplicados da versão anterior.
- Metas: manter simultaneamente aviso de erro, dados desatualizados, estado de
  sessão e editor condicionado ao plano Plus. O aviso de upgrade não substitui o
  aviso de falha das consultas.
- Assinaturas: preservar catálogo, ciclo mensal/anual, checkout simulado,
  persistência no perfil, cancelamento e integração com o AuthContext publicados.
  Ajustar apenas sincronização de ciclo e parâmetro de checkout para cumprir lint,
  sem reabrir um modal dispensado em cada renderização.
- Serviços de leituras e baseline: preservar os contratos locais, filtros por
  central, erros distintos de vazio, descarte de eventos tardios e testes.
- Navegação de cadastro/login, cadeado de confirmação, confirmação web, sincronização
  de perfil e ajustes de animação/hidratação locais permanecem preservados.
- `app.json` mantém as alterações publicadas de câmera e associação EAS. Isso apenas
  integra configuração versionada; não executa build EAS, publicação ou deploy.

## Documentação dos contratos

`leituras-contract.md` e `historico-diario-contract.md` registram o contrato e o
levantamento de consumidores feitos nas etapas de back-end. Suas listas de adaptações
pendentes são históricas: o trabalho local posterior implementou essas adaptações
no hook e nas telas. O estado atual está em `estados-leituras-front-end.md`.
O hook consome o quarto callback diário; dados brutos não tornam o histórico combinado
completo quando a consulta diária falha.

## Validação

- TypeScript: `tsc --noEmit --incremental false`.
- Lint: `npm run lint -- --no-cache`.
- Testes: `npm test`, incluindo serviços, hook e oito testes da integração.
- Web: `expo export --platform web --output-dir dist`.
- Resultado final: tipos e lint aprovados, 56 testes aprovados e exportação web
  concluída. Artefatos de `dist` são ignorados pelo Git e não entram nos commits.
- `integration-plans.test.cjs` verifica telas reais com Auth, serviços e componentes
  nativos simulados: convivência entre falha e acesso Básico/Plus em Água/Energia/Metas,
  abertura e fechamento de checkout por parâmetro e sincronização do ciclo.
- Testes não fazem operações reais no Firebase nem simulam cobrança real.

## Limitações

- O checkout de pagamento publicado continua sendo uma simulação; nenhuma integração
  com adquirente foi criada. As permissões de plano no cliente não comprovam autorização
  nas regras do Firestore.
- Build e testes locais não homologam câmera, persistência nativa ou regras/índices
  implantados. `react-test-renderer` emite aviso de depreciação.
- Trabalho dos colegas que não foi enviado ao origin e não está neste checkout não
  pode ser recuperado por fetch. Não há evidência local para enumerar esses arquivos.
