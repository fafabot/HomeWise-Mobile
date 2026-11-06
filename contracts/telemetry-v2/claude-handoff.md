# Contratos para Claude e demais responsáveis

Pacote isolado: contrato, prova local de autorização e núcleo de cálculo local aprovados; nenhum comportamento
de produção autorizado. Baseline do app b032d56; PR #3/766de10
permanece separado. Não trocar branch dos colegas nem incorporar gráficos por merge.

## Fonte comum de especificação

1. contract.md define nomes, unidades, campos obrigatórios, nulabilidade e versões.
2. permissions.md define autorização independente da seleção da central no perfil.
3. fixtures/acceptance.json contém resultados esperados, não resultados de produção.
4. product-decisions.md registra aprovação D1–D8 com condições e pendências.
5. fixtures/periods.json: incluir parcela não alocada uma vez se todo o intervalo
   couber no período; não somar novamente os campos distribution_pending.
6. fixtures/baseline.json: 30 dias completos válidos, incluindo zero, sem dia atual;
   referência congelada até recalibração explícita.
7. core/consolidate.cjs: implementação local com contribuições identificadas e revisão
   determinística, sem incrementos em banco. API/limites em core/README.md; testes em
   core/core.test.cjs. Não importar pelo app nem envolver triggers nesta etapa.

O wire format das fixtures usa ISO UTC e números JSON seguros. O adaptador REST usa
os tipos nativos Firestore. Não enviar o envelope de teste/base_event como documento.
O backend atribui horário de recebimento confiável. Nunca incluir token nas leituras.

## Responsabilidades futuras

| Responsável | Contrato a consumir/produzir |
|---|---|
| Firmware | Evento completo v2, épocas, sequência e qualidade; ID estável em replay; fila e diagnósticos; TLS/Auth; não resetar contador à meia-noite |
| Firebase | Vínculo UID↔central e memberships administrados; regras, índices e IAM versionados; evento imutável; contribuições idempotentes e resumos revisionados |
| App/Claude | Parser por versão, preservando null e qualidade; estado atual separado de consumo; fonte única de resumos para painel/gráficos/metas/baseline; fuso da residência |
| Produto | D1–D8, tolerâncias, retenção, cobertura e apresentação de incerteza/legado |

Futuras mudanças do app: leiturasService.ts deixa de escrever resumo; baselineService.ts
deixa de usar máximos de acumulados como dias; AuthContext/authService/scanner deixam
de conceder vínculo por seleção de ID; hook e cálculos consomem contratos versionados.
Preservar estados de erro/desatualização, visual e interação dos gráficos aprovados.

O DTO de resumo está proposto no contrato: consumo em L e Wh, conversão explícita
para kWh na exibição, cobertura/status e revisão. Não atribuir valor zero a resumo
ausente. Energia média em W permanece métrica distinta. A forma final de cobertura
e os endpoints de pareamento ainda precisam ser detalhados após D6/D8; não inventar
esses detalhes no cliente.

## Recorte autorizado e próximos limites

- Reexecutar as mesmas fixtures contra parser/adaptador de cada camada.
- Prova A/B, anonimato, perfil/plano, revogação e imutabilidade executada com regras
  locais em emulator. Não usa Auth real nem valida emissão/rotação de tokens.
- Provar concorrência, triggers repetidos, atraso e revisão sem dupla contribuição.
- App fechado: consolidação continua; duas instâncias do app não escrevem resumos.
- Validar índices reais em homologação: emulador não os exige.
- TLS e orçamento só se validam nas etapas próprias; este oráculo não os demonstra.

Reversão futura: preservar bruto e versão de cálculo, alternar leitores/processadores
por central, não misturar v1/v2 nem reativar TLS inseguro/regras permissivas. Nesta
etapa não existe migração ou alteração de comportamento para reverter.
Capacidade da fila, retenção e qualidade física seguem pendentes. Não excluir dados.
Não implementar transferência; política de histórico após transferência ainda aberta.
