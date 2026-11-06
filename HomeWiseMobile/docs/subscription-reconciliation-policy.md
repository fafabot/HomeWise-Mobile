# Reconciliação e política proposta — assinatura bloqueada para integração

Branch local `integration/2026-11-06-auth-subscription`, base `a3b0c8d`.
Este relatório substitui a interpretação anterior de que ID e timestamp seriam
prova suficiente de conteúdo. Sem commit, push, novo merge ou deploy nesta etapa.

## Regressão e correção

O teste `regression: legacy merge reuses metadata with different plan` foi executado
antes da alteração e falhou: o código aceitava outro plano com o ID/timestamp da
operação anterior. Depois da correção, o mesmo teste passa.

`subscription-consistency.ts` compara também plano, nome do plano, ciclo, status
e método de pagamento com o recibo. Metadados reutilizados com conteúdo diferente,
ID reutilizado com outro timestamp ou empate de revisão entre IDs diferentes
produzem inconsistência. O recibo deixa de ser plano atual: os campos de assinatura
são retirados do perfil exposto, preservando identidade, contato e preferências.
O recibo fica apenas como evidência para consulta, sem conceder plano/benefícios.

O estado é explícito: `assinaturaEstado` = `pronta`, `consultando` ou `inconsistente`,
mais `assinaturaMensagem`. Perfil/cartão mostram “Assinatura em verificação”, sem
afirmar plano antigo, novo ou inexistente. A confirmação temporária anterior é
apagada e não reaparece após resolução. Escritas ficam bloqueadas durante conflito.
Cadastro, recuperação, edição e logout não dependem desse estado e continuam
disponíveis; benefícios dependentes de plano não são concedidos pelo estado incerto.

## Consulta e saída do estado incerto

Na primeira inconsistência confirmada, o contexto faz **uma leitura explícita**
`getDocFromServer`, sem fallback para cache. Há prazo de oito segundos para essa
leitura, nenhuma gravação corretiva automática e nenhum loop de tentativas.

- Se o servidor confirma exatamente o recibo e seu conteúdo, resolve com mensagem.
- Se retorna outra operação, posterior e com plano/ciclo/status/nome válidos,
  aceita a revisão retornada e informa a reconciliação.
- Se mantém os mesmos metadados incompatíveis, retorna documento inexistente,
  dados inválidos, cache/escrita pendente ou falha, mantém **desconhecido** e informa
  a necessidade de nova consulta ou correção por responsável autorizado.
- A UI oferece “Consultar assinatura no servidor”. Uma correção posterior pelo
  responsável não é silenciosamente legitimada pelo listener enquanto há conflito:
  a consulta explícita precisa confirmar a revisão. Nenhum botão força plano local.
- Timeout de leitura ignora o retorno tardio; não é cancelamento do request.
  Geração da conta e token da consulta rejeitam respostas antigas após troca/logout.
- Se o timestamp original nunca foi observado, não se inventa uma ordem para
  outra operação. Esse caso pode continuar inconclusivo e requer evidência do
  backend/responsável, mantendo a assinatura bloqueada.
- Falha do SDK após snapshot conflitante não descarta a evidência nem legitima o
  documento. A consulta pode esclarecer o estado atual, sem toast de contratação.

Assim, não se mantém indefinidamente um plano fixado apenas em memória: após
conflito ele deixa de ser usado como verdade. Pode permanecer um estado **não
resolvido** quando o próprio servidor não permite uma decisão segura. O app não
inventa uma versão, não altera dados e não confunde indisponibilidade com ausência.

## Fechar/reabrir com operação pendente

- Dez segundos de espera da gravação continuam sendo apenas aviso visual; não
  cancelam escrita nem autorizam reenvio. A Promise original segue no app aberto.
- Fechar o checkout não cancela a operação. Se a tela continua montada, uma resposta
  tardia confirmada pode atualizar o estado e mostrar cinco segundos de confirmação.
- Fechar processo/aba **não garante cancelamento nem entrega**. O código não
  implementa fila durável, recibo persistido ou retomada idempotente entre sessões.
- Ao reabrir, a sessão Auth e o perfil são consultados novamente. Não há toast
  reapresentado nem reenvio automático da assinatura. O app pode ler o estado atual,
  mas não reconstruir a cronologia de uma tentativa cujo recibo em memória se perdeu.
- Um conflito anterior ao fechamento não pode ser comparado com um recibo perdido.
  Sem regras/backend homologados e evidência durável, não prometemos detectar o
  mesmo conflito atravessando reload. Isso permanece bloqueador da assinatura.
- A recarga do mock inicia dados sintéticos novos; não é prova de persistência do SDK.

## Bloqueio e autorização

`assinaturaEscritaLiberada` é falso no build normal. Ativação e cancelamento retornam
false **antes de chamar o serviço**, e a tela explica o bloqueio por política ainda
não homologada. A simulação só é liberada no build de revisão
`EXPO_PUBLIC_HOMEWISE_REVIEW=1`, cujo resolver troca todos os módulos Firebase por
mocks em memória. A flag não é autorização de servidor nem habilitação de produção.

Não se concedeu a moradores a capacidade de escrever plano. O wrapper genérico
legado e as regras efetivamente implantadas não foram alterados; proteção real exige
regras/backend, não depende do bloqueio visual. A assinatura inteira continua WIP
para integração, mesmo com os testes locais aprovados.

## Política isolada em `policy/subscription`

Projeto fixo `demo-homewise`. Firestore `127.0.0.1:19080`, hub `127.0.0.1:15400`,
logging `15401` e websocket `19160`; UI de emulador desativada.

- Morador lê somente seu documento e altera campos comuns permitidos. UID/e-mail
  existentes são imutáveis. Novos perfis comuns não podem nascer com plano ativo.
- Documentos antigos, inclusive sem metadados, continuam legíveis. Editar nome ou
  telefone não exige acrescentar metadados nem modifica plano/revisão existentes.
- Nome de campo de cargo ou papel não promove usuário. Mudança de plano/metadados
  por morador é negada, mesmo com ID novo e timestamp correto.
- Somente uma identidade privilegiada **simulada** por claim assinado
  `homewise_subscription_writer` pode alterar assinatura pela política testada.
  Não há emissor de claims ou backend novo implementado. Não se deve distribuir
  esse privilégio ao aplicativo/moradores para acomodar a simulação.
- Escrita privilegiada exige ID textual não vazio de até 200 caracteres e diferente
  do atual, `serverTimestamp == request.time`, timestamp posterior ao atual e
  plano/nome/ciclo/status coerentes. O ID ou timestamp correntes não podem ser
  reaproveitados. Billing/perfil não podem ser modificados nessa escrita privilegiada.
- Exclusão e caminhos não previstos são negados. Testes não limpam banco nem
  excluem documentos: usam IDs sintéticos únicos; tentativas de exclusão são negadas.

A política demonstra rejeição de reutilização **contra o documento corrente**.
Não existe ledger imutável de todos os IDs já usados: não é deduplicação histórica
global, pagamento idempotente ou auditoria completa. Isso exige contrato adicional.
Admin SDK ignora Security Rules; IAM e o backend real precisam de validação própria.

O runner recusa argumentos/configuração inesperados e portas ocupadas; nunca encerra
processos alheios. O teste valida projeto/hosts/hub e faz sondagem local **antes** de
importar SDKs. Sem emulador, falha sem fallback. Credenciais de nuvem são rejeitadas
na prova e removidas do ambiente filho do runner. Dependências próprias são fixadas
em package-lock; a instalação existente foi reaproveitada por junction ignorada,
sem importar código da telemetria v2 ou alterar as dependências do app.

## Reprodução — PowerShell

Na pasta `HomeWiseMobile` integrada:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist
Set-Location policy/subscription
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
```

O runner inicia e encerra seus próprios emuladores. O `npm ci` é necessário apenas
para uma instalação independente dos pacotes de teste, nunca na raiz do app.
Neste worktree a junction de dependências já está provisionada: usar `npm.cmd test`
diretamente. Não executar `npm ci` sobre a junction compartilhada; os comandos de
instalação acima destinam-se a checkout independente, sem essa junction.
Para revisão web, seguem válidos os comandos de build mock/servidor/Playwright em
`integration-auth-subscription-review.md`; `review/browser-smoke.cjs` agora inclui
conflito legado, consulta inconclusiva, correção sintética e consulta resolvida.

## Separação das entregas

As branches fonte de cadastro/perfil (`f1792f0`) e SVG de Metas (`c98ce00`) não foram
modificadas. São as entregas independentes para uma futura integração sem assinatura.
Não usar o AuthContext inteiro do worktree combinado como substituto dessa seleção:
ele contém acréscimos WIP de assinatura. O bloqueio da assinatura não é requisito
de conclusão de perfil, vínculo de central ou saída. Nenhuma nova branch foi mesclada
nesta etapa; o estado de integração pendente anterior foi preservado, sem commit.

## Comprovado e pendente

Comprovado localmente: regressão antes/depois, comparação de conteúdo, consulta
explícita, falhas/timeout/retornos tardios, isolamento de conta, campos comuns de
perfil preservados, bloqueio do build normal, política proposta em emulador e fluxos
de navegação real com mocks. Logs de PERMISSION_DENIED da prova são esperados nas
asserções de rejeição. Não são erros ocultos do aplicativo.

Pendente: obter o texto/versão das regras **implantadas** e identificar seus
gravadores; homologar identidade/backend/IAM e transições reais; resolver evidência
durável entre reinícios, concorrência real, deduplicação histórica e publicação.
Não se aplicou esta política em produção e não se presume que produção esteja
aberta ou protegida. Nenhum emulador da telemetria v2 foi iniciado ou alterado.

Sem Firebase real, firmware, contas reais, recursos pagos, commit, push, merge ou
deploy. Manter assinatura bloqueada para integração até nova autorização e homologação.

## Resultados finais desta etapa

- Regressão executada antes da correção: falhou como esperado; depois passou.
- 212 testes locais passaram (incluem 8 salvaguardas de emulador), zero falhas/ignorados.
- 14 testes da política passaram no Firestore emulado em `demo-homewise`, zero falhas.
- 11 cenários no Edge com Expo Router/guards reais e backend mockado passaram;
  zero erros de página e zero requisições externas nos cenários de navegador.
- TypeScript, lint sem cache/avisos, build web normal e build mock aprovados.
- Sondagem com emuladores encerrados recusou a execução antes de importar SDK,
  comprovando falha fechada sem fallback. Emuladores próprios foram encerrados.
- Whitespace verificado; fontes `f1792f0`/`c98ce00` e worktree da telemetria v2
  permaneceram sem alterações. `HEAD` integrado continua `a3b0c8d`, sem novo commit.
- Relatórios de execução ficam em TEMP: `homewise-reconciliation-tests-final.log`,
  `homewise-subscription-policy-final.log`, `homewise-reconciliation-browser-final.log`,
  `homewise-reconciliation-lint-final.log` e os logs dos dois builds.
