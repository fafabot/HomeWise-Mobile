# Integração local para aprovação

**Atualização:** a reconciliação/política de assinatura foi refinada e permanece
bloqueada para integração fora dos mocks. Ver
[subscription-reconciliation-policy.md](subscription-reconciliation-policy.md).
Os números de 184 testes/10 cenários abaixo registram a etapa anterior, não a
validação posterior. Cadastro/perfil e SVG continuam entregas independentes.

Base após fetch: `origin/main` em `a3b0c8d7f8040b01f4f1b648f7a77fed65dcb22f`.
Branch: `integration/2026-11-06-auth-subscription`, sem upstream para evitar push
acidental para main. Worktree: `HomeWise-Mobile-integration-auth-subscription`.

Fontes conferidas e preservadas:

- `fix/auth-profile-partial-success`: `f1792f0c1be1fffa3611cd894554858ee0b77fda`.
- `fix/metas-svg-transform-origin`: `c98ce0069a5660736c083ee5f401d5914c591624`.
- `feat/assinatura-confirmacao-sucesso`: `596e4f88c9a0d413649b85184361a83ed0cd7fca`.

Não há commit de integração. `HEAD` continua na base. O Git mantém os três hashes
em `MERGE_HEAD`, preservando os pais para um futuro commit somente após aprovação.
A tentativa automática octopus recusou conflito no import do AuthContext. A árvore
foi preparada sem commit (`-s ours`), os três diffs foram aplicados com merge de três
vias e o conflito foi resolvido manualmente. O conteúdo não é um merge que ignora
mudanças: os três conjuntos estão presentes, juntamente com os refinamentos abaixo.
Preferências adicionadas na main e alterações posteriores dos colegas foram mantidas.
Não houve reset de trabalho alheio, rebase ou alteração das branches fonte.

`docs/telemetria-v2-contract` e sua pasta não foram incluídas.

## Refinamentos

### Alertas

`alertas.tsx` deriva preferências do contexto, que já publica a alteração otimista
dos controles. Removeu-se a cópia de estado com sincronização em efeito, eliminando
`react-hooks/set-state-in-effect` sem desabilitar regra. Expansão dos filtros,
solicitação de permissão, mensagens e interações permanecem. Valores remotos passam
a ser refletidos pela mesma fonte, sem efeito redundante.

### Assinatura e confirmação

`AuthContext` continua com a API booleana de ativação/cancelamento, adicionando
`assinaturaPendente`. Uma trava síncrona por sessão impede duas escritas concorrentes.
Snapshots em cache ou com `hasPendingWrites` continuam ignorados. Um snapshot
autoritativo da própria operação, ainda com Promise de gravação pendente, também
não antecipa o plano: o último estado confirmado continua visível.

A gravação proposta acrescenta `assinatura_operacao_id` (identificador único) e
`assinatura_atualizada_em` (`serverTimestamp`) no mesmo documento e mesma escrita.
Esses campos são apenas código local nesta etapa, não foram gravados no Firebase real.
O resultado confirmado fixa os campos de assinatura no perfil compartilhado.
`subscription-consistency.ts` concilia snapshots usando a identidade da operação e
o timestamp atribuído pelo servidor, sem confiar em identidade de objeto nem no
relógio cliente. O horário cliente legado não é usado como revisão de assinatura.

Após a confirmação, snapshots antigos não substituem plano/ciclo/status. Campos
não relacionados (ex.: telefone/preferências) continuam atualizando. Uma revisão de
servidor mais nova pode representar cancelamento/alteração legítima em outra sessão;
snapshots anteriores, mesmo do ID original, não a desfazem. A proteção permanece
durante reinício de listener/consulta no mesmo provider e é limpa na troca de conta
ou logout. Respostas de gravação de outra geração não exibem sucesso na nova conta.

`gerenciar-assinatura.tsx` usa o perfil consistente do contexto; não descarta uma
confirmação ao receber qualquer objeto novo. Mantém simulação sem cobrança, plano e
ciclo da tentativa, rolagem ao topo, anúncio acessível e confirmação por cinco segundos.

### Sem conexão

A Promise original continua em andamento: não há `Promise.race` para convertê-la em
cancelamento. Após dez segundos, só a apresentação muda para espera prolongada e
permite fechar o checkout. O banner informa pendência e possibilidade de conclusão
ao reconectar; reenvio permanece bloqueado pelo contexto. Se a confirmação chegar
com a tela montada, atualiza o perfil, rola e confirma por cinco segundos. Se a tela
foi desmontada, o contexto atualiza o perfil, mas o toast não é reapresentado.

Uma falha/rejeição não afirma que nenhuma contratação ocorreu: o texto pede conferir
o estado antes de nova tentativa. Timeout não cancela a escrita. Fechar navegador
ou perder processo tem as limitações de persistência do SDK; não foi prometida fila
durável de produção nem adicionada persistência nesta etapa.

## Revisão no navegador: exclusivamente mocks

Endereço: `http://127.0.0.1:8097`. O servidor `review/serve.cjs` só escuta loopback,
recusa export sem marca de mocks ou com o identificador do projeto real e aplica CSP
para impedir conexões externas. Não reutiliza servidores de colegas.

No build com `EXPO_PUBLIC_HOMEWISE_REVIEW=1`, `metro.config.js` substitui o módulo de
configuração Firebase e todos os imports `firebase/*` por `review/firebase-mock.ts`.
Esse módulo não importa o SDK real, usa memória e aceita cadastro/login somente com
e-mail `@example.invalid`. Fetch externo é bloqueado. Nada persiste entre recargas;
a recarga inicia novamente a conta sintética, simulando restauração confirmada.
Há faixa visível “REVISÃO LOCAL — MOCKS”, com controles de conta/perfil incompleto,
sensores sintéticos, falha de perfil, desconexão e reconexão. Os controles não têm
efeito em produção; sem a flag, a faixa retorna null e o resolver normal é mantido.

O preview usa componentes, serviços, AuthContext, Expo Router, guards e DOM reais;
somente os limites de backend e permissão de notificações do teste são simulados.
Dados de sensores/CPF/endereço são sintéticos. Não representam homologação de medição,
plano comercial ou cobrança. Nenhuma contratação/cancelamento real foi executado.

## Comandos — PowerShell

Na subpasta `HomeWiseMobile` do worktree integrado:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist

$env:EXPO_PUBLIC_HOMEWISE_REVIEW = '1'
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist-review
Remove-Item Env:EXPO_PUBLIC_HOMEWISE_REVIEW
node review/serve.cjs
```

Em outro terminal, com Playwright instalado fora das dependências do app:

```powershell
# Opcional se a instalação estiver em outro caminho:
# $env:HOMEWISE_PLAYWRIGHT_PATH = 'C:\caminho\node_modules\playwright'
node review/browser-smoke.cjs
```

O runner usa Edge instalado e canal privado por pipe, perfil efêmero, viewport
390×844, bloqueio adicional de rede externa e fecha somente o navegador que criou.
Não exige nem usa login real. O JSON de resultados e captura de falha (se houver)
ficam em TEMP, fora do repositório. Builds e dependências permanecem ignorados.

## Limitações e alinhamento antes de publicação futura

- Campos de operação/timestamp precisam ser aceitos e validados nas regras e por
  todos os gravadores de assinatura. Não foram lidas/alteradas regras de produção,
  nem homologadas permissões dos novos campos. O cliente não substitui autorização
  do plano no backend. Nenhuma migração/recurso pago é necessária para esta revisão.
- Um gravador legado sem revisão não pode sobrescrever a confirmação mantida nesta
  sessão. Não é possível ordenar essa escrita antiga com segurança; não se inventa
  ordem pelo relógio cliente. Precisa de alinhamento antes de misturar clientes em
  produção. Um provider recarregado consulta o servidor novamente e não usa cache
  como prova de perfil completo. Não há migração nem reinterpretacão de dados antigos.
- Antes de observar o timestamp da própria confirmação, uma mudança concorrente de
  outra sessão não é aceita como substituta; mantém-se o recibo local. A prova não
  homologa concorrência entre vários clientes reais nem regras/IAM/billing.
- Offline, fechar o app não garante permanência de escritas em memória. Não se
  implementou retomada durável de recibos, cancelamento de requests ou idempotência
  distribuída de pagamento. A assinatura continua uma simulação acadêmica.
- Aviso de depreciação de `react-test-renderer` nos testes; browser Edge web não
  substitui validação em Android/iOS reais.

Sem Firebase real, firmware ou dados de produção; sem commit, push, merge na main
ou deploy. A integração permanece local, aguardando aprovação.

## Resultados finais

- TypeScript sem emissão/incremental: aprovado.
- Lint sem cache: aprovado, sem erros ou warnings, sem desabilitar regras.
- 184 testes unitários/integrados locais passaram, zero falhas/ignorados.
- Export web normal (`dist`) e export de revisão (`dist-review`): aprovados.
- Dez cenários de navegador Edge com Expo Router/guards reais e SDKs mockados:
  restauração; Metas/SVG; preferências de Alertas; assinatura offline/timeout/
  reconexão/snapshot antigo/confirmacão de cinco segundos; edição parcial e retry;
  logout pelo Perfil; cadastro parcial e recuperação; perfil ausente e saída pela
  conclusão; reload; cadastro rejeitado por conta existente e cadastro completo.
- Zero erros de página e zero requisições externas nos cenários do navegador.
- `git diff --check`: aprovado; nenhuma entrada não resolvida no índice.
- Preview mantido somente em `127.0.0.1:8097`, porta própria. Navegadores efêmeros
  de teste encerrados; nenhum processo de colegas foi encerrado.
- HTTP 200 confirmado. A abertura automática no navegador do usuário foi bloqueada
  pela revisão automática (`blocked by policy`); usar o link local acima.
- Logs e JSON de execução estão em TEMP com prefixos `homewise-integration-*` e
  `homewise-integrated-*`, fora dos arquivos a integrar.
