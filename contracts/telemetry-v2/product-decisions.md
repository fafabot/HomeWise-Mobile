# D1–D8 — diretrizes aprovadas para contrato e testes isolados

O usuário aprovou as diretrizes abaixo para contrato e testes isolados, incluindo
somente prova local de autorização em demo-homewise. Não é homologação de produção.

| ID | Decisão | Diretriz aprovada | Pendência/limite |
|---|---|---|---|
| D1 | Lacunas e períodos | Preservar consumo não alocado. Se todo o intervalo estiver no período consultado, incluí-lo uma única vez, indicando distribuição pendente. Sem estimativas silenciosas. | Atraso máximo, revisão e reconstrução de relógio ainda precisam de critérios. |
| D2 | Referência | Primeiro contador é referência, salvo continuidade comprovada com amostra anterior. | Persistência e prova de continuidade precisam de ensaio; sem origem zero inventada. |
| D3 | Qualidade | Diferenciar zero válido, falha, ausência e dado antigo. | Limites físicos e prazos são provisórios até ensaio. |
| D4 | Fuso | Usar fuso da residência com vigência, sem reorganização automática do passado. | Administração da mudança de fuso ainda será detalhada. |
| D5 | Retenção | Não excluir dados nesta etapa. | Capacidade da fila e prazos de retenção dependem de orçamento e testes; sem TTL ou clearFirestore. |
| D6 | Baseline | 30 dias completos e válidos, incluindo zero medido, excluindo dia atual; recalibração explícita. | Critério físico de validade/cobertura depende de ensaio. Congelar referência obtida até recalibração explícita. |
| D7 | Legado | Preservar separado e identificado; sem migração ou mistura silenciosa. | Apresentação final e recuperação futura fora desta etapa. |
| D8 | Autorização | Conhecer ID não concede acesso; vínculo é administrado. | Histórico após transferência pendente; transferência não deve ser implementada. |

## Portões técnicos adicionais

- Sem regra/índice implantado disponível, não declarar produção segura.
- A prova local usa serverTimestamp validado por request.time; não homologa o
  adaptador REST do firmware nem provisionamento real.
- TLS: validar cadeia/hostname nos endpoints de Firestore/Auth, renovação de confiança,
  plausibilidade do relógio, RAM, MFLN e watchdog em bancada separada.
- Uma credencial em ESP8266 pode ser extraída fisicamente; proteção maior depende de
  hardware. Autenticação não homologa precisão nem elimina fraude da própria central.
- Sem recursos pagos ou faturamento nesta etapa. Serviços futuros precisam orçamento
  por volume, retenção, listeners, processamento e logs; alertas não são teto de gastos.

## Escopo autorizado

Contratos, fixtures, prova de autorização local anterior demo-homewise e, na etapa
atual, somente núcleo de cálculo/consolidação em memória com dados sintéticos.
Não implementar triggers, armazenamento Firebase ou migração. Não reiniciar emuladores
para o núcleo, que não depende deles.
Sem alteração de app/firmware ou produção, transferência, migração, exclusão de dados,
faturamento, deploy, commit, push ou merge. Qualquer etapa seguinte exige aprovação.
