# Alternativa mínima de confirmação de simulação

Branch `feat/assinatura-confirmacao-minima`, worktree
`HomeWise-Mobile-assinatura-minima`, base local disponível de `origin/main` em
`7f45064` (inclui a atualização do gráfico de Energia e do detalhamento do Início).
Sem upstream, commit, push, merge ou deploy. Não foram iniciados emuladores nem
consultadas/alteradas regras ou infraestrutura de assinatura nesta etapa.

## Comportamento preparado

- Usa `atualizarPlanoAssinatura` existente, com os mesmos campos e retorno booleano.
  Somente `true` dispara confirmação de simulação.
- Após sucesso, fecha o checkout, rola ao topo e mostra “Simulação concluída” por
  cinco segundos. Mantém selo de simulação e aviso de ausência de cobrança real.
- Plano/ciclo da mensagem são os capturados na tentativa, não uma escolha posterior.
- O cartão e Cancelar usam o perfil do contexto existente. Após o serviço confirmar,
  o contexto aplica o mesmo patch aos dados em memória, preservando os outros campos;
  não há uma segunda gravação. Cancelamento bem-sucedido usa o mesmo princípio.
- `false` ou exceção mantêm checkout/dados, mostram mensagem de confirmação não
  obtida e não disparam sucesso nem rolagem. Não se afirma rollback/cancelamento.
- Trava síncrona evita dois envios pelo mesmo formulário antes do rerender.
- Resposta depois de desmontar não cria confirmação/rolagem/timer. A atualização do
  contexto não aplica dados a outra conta. Recarga/reabertura não repete o toast.
- Parâmetro de deep link do checkout é retirado após sucesso, preservando a intenção
  anterior de não reabrir automaticamente uma contratação já respondida.

Não há campos novos no Firestore, recibos, revisões, consultas corretivas, barreiras
de snapshot, novos tipos de dados ou mudança de autorização. Serviço de persistência,
configuração Firebase e regras permanecem idênticos à base.

## Limitações existentes — não é pagamento homologado

O `true` representa a confirmação do serviço atual de gravação do perfil. Não
representa cobrança aprovada, recibo financeiro, validação de pagamento ou concessão
de direitos por backend confiável. PIX/cartão continuam demonstrações acadêmicas.

O contexto legado continua publicando snapshots sem filtrar ecos locais pendentes.
Por isso, o cartão pode refletir uma escrita local antes da resposta e reverter em
falha. O novo feedback de sucesso depende de `true`, mas o cartão isoladamente não
prova confirmação no servidor. Essa alternativa mínima não corrige esse comportamento.

Snapshots posteriores continuam prevalecendo, inclusive um perfil antigo que
contradiga o cartão durante os cinco segundos da mensagem. Não há mecanismo de
reconciliação ou garantia de ordenação entre aparelhos. Um teste registra essa
limitação explicitamente, sem tratá-la como nova garantia de produção.

Sem conexão, a Promise pode continuar pendente e a tela pode permanecer processando;
o prazo de cinco segundos só começa após sucesso. Não há timeout novo, fila durável,
reenvio automático ou deduplicação distribuída. Fechar app/aba não garante cancelamento
nem entrega da escrita. Uma sessão reaberta depende da consulta normal do perfil.

Os testes usam mocks de SDK/serviço e dados sintéticos; não homologam regras
implantadas, autorização de plano, pagamento, rede real ou iOS/Android. O build
normal mantém a configuração Firebase existente e não foi aberto para testar contas
reais; validação automatizada não importa essa configuração nem faz ViaCEP real.

## Arquivos

- `src/app/gerenciar-assinatura.tsx`: feedback mínimo, scroll, retorno seguro e trava.
- `src/components/SubscriptionUI.tsx`: ref opcional para a rolagem existente.
- `src/contexts/AuthContext.tsx`: atualização local após sucesso, mesmos payloads.
- `tests/assinatura-minima.test.cjs`: dez testes da tela/helper com mocks.
- `tests/assinatura-minima-context.test.cjs`: seis testes do contexto real com SDK
  mockado, preservação de campos e verificação das chaves exatas enviadas.
- `tests/experimento-visual.test.cjs`: apenas quatro expectativas de texto atualizadas
  de “Pagamento aprovado” para “Simulação concluída”; teste/gráfico de Energia intocados.
- Este relatório.

## Validação — PowerShell

Na subpasta `HomeWiseMobile` do worktree mínimo:

```powershell
node --test tests/assinatura-minima.test.cjs tests/assinatura-minima-context.test.cjs
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
.\node_modules\.bin\eslint.cmd --no-cache src/app/gerenciar-assinatura.tsx src/contexts/AuthContext.tsx src/components/SubscriptionUI.tsx
.\node_modules\.bin\eslint.cmd --no-cache --global __dirname tests/assinatura-minima.test.cjs tests/assinatura-minima-context.test.cjs tests/experimento-visual.test.cjs
npm.cmd test
npm.cmd run lint -- --no-cache
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist --clear
```

`__dirname` é declarado como global padrão Node somente na verificação dos testes
CJS; nenhuma regra foi desabilitada. A limpeza do cache no export evitou reutilizar
um transform de rotas de outro worktree que compartilha as dependências por junction.
Não foram alteradas dependências, configurações ou código de outro worktree.

Resultados:

- 16 testes novos passaram; TypeScript e build web passaram.
- Lint dos arquivos alterados passou.
- Suíte completa: 96 passaram, uma falha herdada do teste de Energia em
  `experimento-visual.test.cjs:404`: ainda espera “Potência média 40.2 W”, enquanto
  a base `7e5d02b` passou a apresentar consumo em kWh. O mesmo teste original foi
  executado diretamente de `HEAD` e reproduziu a falha. Fonte Energia idêntica à base.
- Lint geral: falha herdada `react-hooks/set-state-in-effect` em `alertas.tsx:51`.
  Alertas não foi alterado nesta alternativa. Não se declara a suíte global verde.
- `react-test-renderer` avisa sobre depreciação, sem falhas nos testes novos.
- Logs em TEMP com prefixo `homewise-minimal-*`, fora do repositório.

## Trabalhos preservados

A implementação avançada continua em `integration/2026-11-06-auth-subscription`,
sem alteração do conteúdo/index/estado local. Nenhum arquivo dela foi movido ou
substituído; os trabalhos de regras e infraestrutura não avançaram.

Cadastro/perfil continua independente em `fix/auth-profile-partial-success`
(`f1792f0`), SVG em `fix/metas-svg-transform-origin` (`c98ce00`) e telemetria v2
permanece WIP separada (`e846574`). Nenhuma dessas branches foi integrada aqui.
Combinar entregas exige revisão posterior, preservando as mudanças da main;
esta alternativa não introduz nem substitui os novos guards de cadastro/perfil.

Alternativa apenas local para avaliação. Não é autorização ou recomendação de
publicar assinatura comercial sem homologação das regras e do fluxo financeiro.
