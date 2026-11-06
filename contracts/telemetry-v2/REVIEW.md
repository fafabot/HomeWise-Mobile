# Núcleo local de cálculo e provas anteriores — resultados

Status registrado: etapa do núcleo local concluída com 126 testes aprovados,
conforme resultados abaixo. Trabalho pausado por solicitação do usuário, mantido
em docs/telemetria-v2-contract no worktree separado e sem commit. Não incorporado
ao app. Aguardar autorização explícita antes de outra etapa, commit, push, merge,
rebase, pull ou deploy.

Branch local: `docs/telemetria-v2-contract`, baseada em `main`/`b032d56`.
Worktree separado: `HomeWise-Mobile-contract-v2`.
Todos os arquivos novos estão somente em `contracts/telemetry-v2/` e sem commit.
O checkout original e o worktree dos gráficos permanecem nas suas branches, sem
mudanças rastreadas. Na verificação final apareceu package-lock.json não rastreado
na raiz do checkout original (94 bytes, packages vazio); foi preservado, sem remoção
ou atribuição de autoria. O lockfile desta prova está separado na subpasta emulator.
D1–D8 aprovadas como diretrizes com as condições registradas em product-decisions.md.
A prova anterior usou somente demo-homewise local com dados sintéticos. A etapa
atual de cálculo não inicia emuladores nem faz conexões Firebase.

## Etapa atual — núcleo local de cálculo/consolidação

Arquivos novos: core/consolidate.cjs, core/core.test.cjs e core/README.md. Documentos
de contrato, diretrizes, handoff, README e este relatório foram alinhados à etapa.
Os comandos são identificados como PowerShell, inclusive na documentação da prova
anterior. Nenhuma mudança no código do app, firmware, regras ou testes de emulador.

O núcleo expõe consolidate, createLocalConsolidator e summarizePeriod. Deduplica
eventos, reconstrói contribuições com IDs determinísticos, conserva consumo não
alocado e consulta períodos sem estimativa silenciosa. Replay ou reordenação do
mesmo conjunto preserva snapshot e revision. Ingestão tardia substitui intervalos
vizinhos em vez de incrementar o total antigo. Falha de cálculo não confirma um
lote parcialmente no estado em memória.

Resultados da etapa atual:

- 49 testes do núcleo passaram, incluindo 24 permutações de quatro eventos,
  ingestão por lotes/replay, conflito de ID, reinícios com/sem continuidade explícita,
  reset/época reutilizada, qualidade inválida, lacunas e conservação.
- 77 testes de contrato permaneceram aprovados; total da execução atual: 126,
  zero falhas. Provas de autorização da etapa anterior não foram reiniciadas.
- Caso mensal: 1 L conhecido em cada dia + 2 L entre dias = 4 L, incluindo 2 L
  com distribuição pendente; cruzar meses mantém a parcela fora de ambos os meses.
- Amostra tardia na meia-noite resolve a divisão sem acrescentar consumo mensal.
- Teto numérico, valores pequenos positivos, horário de verão, null/zero e isolamento
  de opções/entradas/saídas do acumulador também foram verificados.
- Lint do código CJS local e typecheck do aplicativo original passaram. A inspeção
  final verifica whitespace, branches e preservação das alterações dos colegas.

Comando reproduzível na raiz do worktree, sem instalar dependências:

```powershell
node --test contracts/telemetry-v2/contract.test.cjs contracts/telemetry-v2/core/core.test.cjs
```

Limitações: recomposição integral em memória, sem banco/transações/concorrência
distribuída. Cobertura sempre partial; nenhuma promoção automática de dias completos
ou baseline física. Critérios de relógio/qualidade e prova real de continuidade ainda
precisam de ensaio. Não há fila persistente, política de retenção, vigência de fuso,
triggers, migração, Firebase real ou integração no app. Números usam ponto flutuante
com soma compensada; não são consumo faturável homologado.

## Registro da etapa anterior — autorização emulada

## Resultados esperados mais relevantes

| Entrada sintética | Resultado esperado |
|---|---|
| Primeiro contador em 100 L | Referência, não 100 L de consumo diário |
| 100 → 103 → 103 L; energia 1000 → 1002 → 1002 Wh | 3 L e 2 Wh recuperados no intervalo |
| Reenvio do mesmo ID/conteúdo, ordem de chegada invertida | Mesmo total, sem dupla contribuição |
| Mesmo ID com conteúdo diferente | Conflito, sem contribuição do ID disputado |
| Boot do ESP com nova época de água e PZEM contínuo | Não cruzar contadores de água incompatíveis; continuar delta do medidor |
| Queda de contador sem nova época | Sinalizar inconsistência, sem consumo negativo |
| UTC muda de data às 00:00, residência São Paulo ainda no mesmo dia | Continuar no dia civil da residência |
| Intervalo 23:59:50 → 00:00:10 da residência | Preservar delta como não alocado, sem rateio silencioso |
| Mesmo intervalo inteiro dentro do mês | Incluir no mês uma vez; indicar parcela com distribuição diária pendente |
| Intervalo atravessa outubro/novembro | Não atribuir aos meses isolados; ano que contiver tudo pode incluir uma vez |
| 1 L conhecido em cada dia e 2 L entre dias | Mês 4 L, incluindo 2 L com distribuição pendente; soma diária conhecida 2 L |
| Evento de 6/11 recebido em 8/11 | Não mover consumo ao dia da recepção; limite de atraso ainda pendente |
| Falha de água entre dois contadores válidos | Recuperar delta possível e marcar lacuna; energia continua independente |
| Métrica sem contribuição, outra métrica válida no mesmo dia | null na primeira; não inventar zero válido |
| Leitura zero válida versus nenhum evento | Intervalo zero observado versus ausência de dia alocado |
| Central A tenta gravar em B; morador seleciona B sem vínculo | Negar pela política proposta |
| Serviço consolidador versus serviço administrativo | Escrita de resumos separada de provisionamento/revogação |
| Legado v1 ou versão desconhecida | Identificar legado ou unsupported; não somar ao v2 |
| Baseline 30 dias completos válidos, um com zero | Zero conta; dia atual, incompletos, inválidos e legado ficam fora |
| Baseline já fixada e novos dados | Referência não muda sem recalibração explícita |

Calibração de 1000 pulsos/L é propositalmente sintética, não é recomendação para
o sensor físico. Os resultados de intervalos têm cobertura parcial. Flags de dia
completo/válido da fixture de baseline são sintéticas: não homologam sensores ou
cobertura física de um dia. Nenhum resultado é um total faturável homologado.

## Validação da etapa anterior

- `node --test contracts/telemetry-v2/contract.test.cjs`: 77 testes passaram.
- Na subpasta emulator, `npm.cmd run test:guards`: 16 testes passaram.
- Na subpasta emulator, `npm.cmd test`: 11 testes passaram no Firestore local;
  processo da suíte retornou 0 e o runner encerrou os emuladores próprios.
- Total: 104 testes, zero falhas na execução final.
- ESLint no código CJS novo, sem cache, com no-undef/no-unused-vars e globals Node
  declarados na linha de comando: passou; não é lint das dependências instaladas.
- Typecheck do app original: `tsc --noEmit --incremental false`; nenhum código do
  pacote é importado pelo aplicativo. Passou.
- Sondagem real com projeto/hosts corretos e emuladores já parados: rejeitada antes
  da importação do SDK. Configuração ausente ou host/projeto errado também falha.
- Whitespace e ausência de mudanças rastreadas dos colegas verificados na entrega;
  arquivo não rastreado do checkout original preservado conforme observação acima.

Ferramentas: Node 24.15.0, Java 26.0.2, firebase-tools 15.35.0, emulador Firestore
1.22.0, firebase 13.2.0 e rules-unit-testing 6.0.0. Lockfile separado. A CLI baixou
o binário oficial na primeira execução; nenhuma operação usou projeto Firebase real.

As regras realmente executadas são apenas as desta pasta. Identidades autenticadas
são simuladas com authenticatedContext; assertFails exige permission-denied, e
assertSucceeds prova os caminhos permitidos. Isto não comprova emissão/validação de
tokens, Auth real, IAM, regras/índices implantados, TLS, hardware ou concorrência de produção.
Não houve deploy, migração, exclusão de documentos, clearFirestore, commit, push,
merge ou alteração de recursos/configuração/dados de produção. O estado sintético
do emulador é efêmero e termina com o processo, sem ser política de retenção.

## Revisão necessária antes de seguir

As ressalvas permanecem: limites/prazos de qualidade, capacidade de fila, retenção e
orçamento, serviço de pareamento e acesso ao histórico após transferência. Nenhuma
transferência implementada. Contrato de resumo e diagnósticos ainda não são APIs de
produção; D1/D6 estão demonstradas em oráculos locais, não num backend em execução.

A aprovação atual termina no núcleo de cálculo local descrito acima. Não autoriza
migração ou uso em produção. Comandos da prova anterior e salvaguardas permanecem
em emulator/README.md; não são necessários para executar os testes do núcleo.
