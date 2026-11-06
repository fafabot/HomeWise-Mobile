# HomeWise — proposta de contrato de telemetria v2

Status: **D1–D8 aprovadas como diretrizes; prova de autorização e núcleo de cálculo locais autorizados;
não autorizado para produção, migração ou transferência**.

Esta pasta é independente do aplicativo e firmware. Nenhum arquivo daqui é importado
pelo app. Não contém credenciais reais. reference.cjs é um oráculo puro sem rede;
emulator tem dependências próprias e acessa somente Firestore local em demo-homewise.
Não é um consolidador ou conjunto de regras pronto para produção.

Base: HomeWise-Mobile `b032d56`; firmware remoto `4222c9e`, confirmado na main e na
branch de conexão direta na investigação anterior. Comunicação básica confirmada
pela equipe; precisão, segurança e cálculos ainda não homologados. PR #3 dos gráficos
permanece separado em `766de10`. Nenhum desses commits foi modificado.

## Arquivos para revisar

- [Contrato](contract.md): campos, unidades, tempo, contadores e legado.
- [Permissões](permissions.md): política proposta e exemplos de autorização.
- [Diretrizes e pendências](product-decisions.md): aprovação com condições e limites.
- [Integração com Claude](claude-handoff.md): responsabilidades e critérios compartilhados.
- [Fixtures](fixtures/acceptance.json): entradas sintéticas e resultados esperados explícitos.
- [Referência local](reference.cjs) e [testes](contract.test.cjs): validação e aritmética dos exemplos.
- [Fixtures por período](fixtures/periods.json): D1 diário/mensal/anual.
- [Fixture de baseline](fixtures/baseline.json): D6, incluindo zero válido.
- [Prova emulada](emulator/README.md): comandos, salvaguardas e limitações.
- [Resultados](REVIEW.md).
- [Núcleo local implementado](core/README.md): cálculo e recomposição em memória,
  contribuições identificadas e consultas por período; sem Firebase.

## Executar contrato e núcleo local — PowerShell

Na raiz deste worktree, com Node.js disponível, sem instalar pacotes:

```powershell
node --test contracts/telemetry-v2/contract.test.cjs contracts/telemetry-v2/core/core.test.cjs
```

As fixtures usam um envelope completo `base_event` e alterações por evento em `events`.
Cada evento de entrada é a mesclagem rasa de `base_event` com essas alterações. Os
mapas `quality` são substituídos integralmente quando presentes. Isso é uma convenção
de fixtures; o firmware deverá enviar o evento completo, sem herança ou alterações.
`received_at` fica no envelope do servidor, nunca no payload da central.

Os testes de contrato verificam tipos, qualidade, conflitos, deduplicação, ordem,
deltas, períodos, baseline e legado. A suíte separada emulator executa regras locais
com identidades simuladas. Nenhuma comprova TLS, emissão de tokens, índices reais,
triggers, persistência da fila ou precisão física.

## Resultado esperado para revisão

Sequência 100 → 103 → 103 L gera 3 L; replay não acrescenta consumo; chegada fora de
ordem mantém o resultado. Mudança de época não cria um delta entre contadores
incompatíveis. Intervalo que cruza o dia civil fica separado como não alocado, sem
estimativa silenciosa. A/B ficam isoladas na matriz proposta. Legado não entra no v2.

Se todo o intervalo estiver no mês, summarizePeriod inclui a parcela uma única vez
e indica distribuição pendente. Se cruzar a fronteira mensal, não a atribui a um
dos meses. Baseline usa 30 dias completos válidos, incluindo zero, sem o dia atual.

A autorização atual cobre contrato/testes, a prova local anterior descrita em
emulator/README.md e o núcleo de cálculo em core/. Nesta etapa não reiniciar emuladores.
Sem provisionamento real, triggers, migração, transferência, exclusão,
deploy, commit, push, merge ou mudanças no app.
