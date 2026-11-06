# Integração local sobre a main aprovada

> Registro da validação local que precedeu a aprovação. As referências abaixo a
> HEAD na base, ausência de upstream e ausência de commit/push descrevem aquela
> etapa. A publicação posteriormente autorizada está registrada ao final.

Branch `integration/2026-11-06-approved-minimal`, sem upstream.
Worktree `HomeWise-Mobile-integration-approved-minimal`.
Base `7f45064f05ea936eea713db83460bfbf69a1303f`, conferida também por
`git ls-remote origin refs/heads/main` durante a validação.

Fontes aplicadas como diffs locais, sem `git merge`, cherry-pick, commit ou push:

- Cadastro/perfil/logout: `f1792f0c1be1fffa3611cd894554858ee0b77fda`.
- SVG de Metas: `c98ce0069a5660736c083ee5f401d5914c591624`.
- Confirmação mínima: `ab00586e5874b3a0deff86abb53b99f191af9061`.

Os commits e worktrees fonte foram preservados. Não foram incluídos a integração
avançada `50a351e`, sua política/reconciliação, nem telemetria v2 `e846574`.
Não há `MERGE_HEAD` ou conflitos não resolvidos neste worktree. HEAD permanece na
base; as mudanças estão apenas locais para revisão.

## Preservação das mudanças dos colegas

`src/app/energia.tsx` e `src/app/index.tsx` permanecem **byte a byte iguais à main**.
Nenhuma alteração foi feita no cálculo, visual ou comportamento aprovado desses
arquivos. Permanecem Energia acumulada em kWh por período, potência instantânea
separada, gasto diário, componentes Água/Energia, gasto acumulado e média aprendida
em linhas próprias, incluindo as mudanças `7e5d02b` e `7f45064`.

Houve um conflito de importação no AuthContext: a main adicionara preferências de
notificações; o cadastro/perfil adicionara contratos de conclusão. A resolução
mantém **ambos** e mantém a função de atualização de preferências da main. A
atualização local do cartão após retorno booleano da assinatura foi acrescentada
às funções correspondentes, preservando as proteções de sessão do cadastro/perfil.
Nenhum arquivo completo da main foi substituído por versão antiga de uma branch.

## Teste de Energia atualizado, sem enfraquecimento

A falha anterior esperava “Potência média 40.2 W” para um gráfico que passou a
consumo acumulado. A fixture já contém `energia_kwh: 1`; o teste agora exige
“Consumo no período”, valor 1 e unidade kWh, mantendo seleção da barra, toque dentro,
fechamento fora e troca de período. Também exige o título correto e rejeita a antiga
métrica no balão. Os testes genéricos do componente ainda podem exercitar W como
unidade arbitrária; isso não muda a tela aprovada de Energia.

Foi acrescentada regressão com data fixa e valores conhecidos, usando os componentes
reais: Dia = 1,25; Semana = 3,25; Mês = 6,25; Ano = 15,25 kWh. Ela confere valor e
unidade no **mesmo balão**, mistura resumos e leitura de hoje sem duplicação e
exclui dados de outro ano. Não calcula o esperado chamando o algoritmo testado.

Outra regressão renderiza Início e confere linhas financeiras separadas e valores:
gasto diário R$ 2,55, Água R$ 0,85, Energia R$ 1,70, acumulado R$ 7,65 e média
aprendida R$ 1,70/dia. Usa as tarifas existentes da aplicação; não homologa tarifas,
medição física ou faturamento.

## Ajuste de lint em Alertas

O erro conhecido `react-hooks/set-state-in-effect` foi comunicado antes da alteração.
Foi removida a cópia redundante de preferências sincronizada por efeito. O contexto
já executa atualização otimista dos controles; a tela agora deriva os valores dele.
Não foram alterados filtros, limiares, solicitação de permissão, estilos ou textos de
notificações. O cenário de navegador exercita a ativação. Nenhuma regra ESLint foi
desabilitada e não se alterou Energia/Início para fazer testes passarem.

## Confirmação mínima e autenticação

Mantém serviço booleano e schema existente. `true` fecha checkout, atualiza o cartão
pelo contexto, rola ao topo e confirma a **simulação** por cinco segundos. `false` ou
exceção não exibem sucesso. Mantém Cancelar e trava de envio. O contexto combinado
ignora cache/escritas pendentes por causa da correção de perfil já aprovada; não
foi acrescentado recibo de assinatura, novo campo, versão, backend ou reconciliação.

Snapshots autoritativos posteriores ainda podem substituir o cartão; não há garantia
de ordenação entre clientes, pagamento homologado ou fila durável. A confirmação
mínima não substitui autorização no servidor. As limitações históricas da alternativa
fonte estão em `assinatura-confirmacao-minima.md`; este relatório atualiza o contexto
da combinação, cuja autenticação/guards são os corrigidos, não os antigos da main.

Os testes do contexto mínimo foram adaptados para a API real integrada: restauração
do Auth, snapshots com metadados e ciclo de troca de conta. Não foram retiradas
asserções de sucesso/falha/payload ou isolamento. A suite de cadastro/perfil continua
cobrindo completo, parcial, recuperação, leitura ausente/erro, recarga e callbacks
antigos. Nenhuma senha ou conta real foi usada.

## Validação local e reprodução — PowerShell

Na subpasta `HomeWiseMobile` deste worktree:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist

$env:HOMEWISE_LOCAL_VALIDATION = '1'
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist-validation --clear
Remove-Item Env:HOMEWISE_LOCAL_VALIDATION
node validation/browser-smoke.cjs
```

O último comando usa Playwright instalado fora do app (o caminho padrão reutiliza
`TEMP/homewise-browser-check/node_modules/playwright`; pode ser configurado em
`HOMEWISE_PLAYWRIGHT_PATH`). Usa Edge instalado, viewport 390×844 e canal privado
de automação. Inicia servidor exclusivamente em `127.0.0.1:8098`, recusa porta
ocupada e fecha seu servidor/navegador ao terminar. Não reutiliza nem encerra
servidores de colegas. Não abre um navegador com Firebase real.

O modo de validação troca **todos** os imports Firebase e sua configuração por
`validation/firebase-mock.ts`. Sem a flag, o resolver normal permanece. O servidor
recusa build com identificador do projeto real ou sem marcador de mocks e bloqueia
conexões externas por CSP e interceptação. O mock é inteiramente em memória, aceita
somente e-mails `@example.invalid` e rejeita novos campos de assinatura. Não importa
regras nem mecanismos de assinatura avançada. A flag/configuração servem apenas ao
teste, não são controle de autorização de produção.

Resultados finais:

- TypeScript passou.
- Lint sem cache passou, sem erros/avisos.
- **190 testes locais passaram**, zero falhas, cancelados ou ignorados.
- Builds web normal e de validação passaram.
- **Seis cenários de navegador passaram** com Expo Router/guards/componentes reais:
  restauração e linhas financeiras; Energia em todos os períodos/balões; Metas/SVG
  e preferências; assinatura mínima/cartão/Cancelar/cinco segundos; edição parcial
  com rascunho/retry; logout e cadastro parcial com recuperação na mesma conta.
- Zero erros de página e zero requisições externas nos cenários de navegador.
- `git diff --check` passou. Arquivos de Energia/Início e configuração Firebase
  permanecem iguais à base. Nenhum contrato/política de telemetria foi importado.
- Logs e JSON ficam em TEMP com prefixo `homewise-approved-minimal-*`, sem captura
  ou build adicionado ao Git. `react-test-renderer` emite seu aviso de depreciação.

Limites: mocks não homologam Firebase/regras implantadas, pagamento real, concorrência
real nem Android/iOS físicos. Nenhuma conta, dado, firmware ou recurso de produção
foi alterado. Nenhum emulador, commit, push, merge ou deploy foi executado nesta etapa.
As branches avançada e telemetria v2 continuam preservadas, separadas e WIP.

## Publicação aprovada — 2026-11-06

O responsável aprovou a combinação mínima e autorizou commit, publicação e PR
para main, preservando as demais branches. Um novo fetch confirmou main ainda
em `7f45064f05ea936eea713db83460bfbf69a1303f`, sem mudanças adicionais a incorporar.
Foi feito backup externo com bundle de todas as referências, patches do índice
e do diretório de trabalho e cópia dos arquivos modificados/não rastreados.

A suíte completa foi repetida: 190 testes aprovados, além de tipos, lint sem
cache e exportação web normal. A inspeção dos bundles normais exige configuração
Firebase normal e ausência do controle de mocks, conta sintética e bloqueio de
rede de validação. O navegador de validação usa exclusivamente o build sintético
anteriormente validado; o build normal não foi usado para gravações de teste.

Não foram incluídos builds, node_modules, capturas, arquivos temporários,
assinatura avançada, regras Firebase ou telemetria v2. A assinatura permanece
simulada, sem homologação de pagamento. Firebase real e aparelhos Android/iOS
ainda não foram homologados para os novos fluxos.
