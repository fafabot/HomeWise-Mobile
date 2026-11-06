# Núcleo local de cálculo e consolidação

Escopo autorizado: módulo local com dados sintéticos. Não importa SDK Firebase,
app ou firmware; não usa rede, disco, relógio de execução, triggers ou migração.
Nenhuma importação deste núcleo foi adicionada ao aplicativo.

## Executar — PowerShell

Na raiz do worktree HomeWise-Mobile-contract-v2:

```powershell
node --test contracts/telemetry-v2/contract.test.cjs contracts/telemetry-v2/core/core.test.cjs
```

Não exige instalação, Firebase CLI, emuladores ou acesso à internet. A suíte usa
somente Node.js e fixtures locais. A prova de regras da etapa anterior é separada
e não precisa ser reiniciada para testar este núcleo.

## API local

- `consolidate(events, options)`: lote completo de payloads v2 puros, sem received_at.
  Retorna snapshot novo e não modifica as entradas.
- `createLocalConsolidator(options)`: armazena variantes brutas em memória.
  `ingest(events)` acrescenta variantes sem duplicar replays e recompõe o snapshot;
  `snapshot()` permite recalcular sem novo evento. Falha de consolidação não confirma
  um lote parcialmente. Não há exclusão, persistência ou atualização de produção.
- `summarizePeriod(snapshot, { start, end })`: consulta as contribuições calculadas
  usando limites UTC completos com milissegundos. O chamador deriva os limites do
  fuso vigente da residência. Não consumir snapshot externo alterado ou não validado.

Options exigem `device_id`, `timezone` e mapa de calibrações imutáveis em pulsos/L.
O núcleo reutiliza apenas validate/localDate do contrato de referência; o cálculo
de contribuições é implementação própria, testada contra as fixtures aprovadas.

### Continuidade entre reinícios

Dentro de uma época, sequência/uptime e horário precisam ser coerentes. Ao cruzar
boots, o núcleo exige evidência explícita em opções confiáveis, por exemplo:

```json
{"metric":"energy_wh","from":"boot-a__1","to":"boot-b__0"}
```

Essa evidência liga exatamente duas amostras adjacentes válidas da mesma época;
não é campo do payload do produtor. Sem ela, o primeiro contador do novo boot é
referência. Declarar a evidência não autoriza delta negativo ou cruzar épocas,
calibrações diferentes ou boots com horários sobrepostos. Neste ambiente, a evidência
é sintética. Definir como comprová-la no sistema real continua fora desta etapa.

## Snapshot e cálculo

- `contributions`: intervalos com IDs determinísticos, origem/destino, métrica, época,
  calibração, valor, data local ou distribuição pendente e indicação de lacuna.
- `totals`: soma das contribuições recuperadas, em L e Wh. null significa nenhuma
  contribuição comprovada; zero exige intervalo válido com delta zero.
- `daily`: somente intervalos inteiramente atribuíveis a um dia; campo sem contribuição
  fica null. Um intervalo terminando exatamente à meia-noite fecha o dia anterior.
- `unallocated`: consumo recuperado cuja distribuição diária não está comprovada.
- `latest`: última amostra com ordem/relógio utilizáveis; preserva qualidade e null.
  Sem limiar físico aprovado, o núcleo não inventa timeout para transformar valid em stale.
- `diagnostics`: rejeições, conflitos, quedas, lacunas e continuidade não comprovada.
- `revision`: hash determinístico do resultado, não contador de tentativas nem horário.

Duplicata exata é ignorada. Conteúdos diferentes com o mesmo ID são excluídos dos
cálculos, com conflito preservado mesmo após replay. Uma amostra tardia substitui
os intervalos vizinhos pelo novo conjunto; não soma os deltas antigos aos novos.
Ordem incoerente coloca o boot fora do cálculo. Queda de contador bloqueia o restante
da época afetada, preserva contribuições anteriores e permite retomar em nova época.
Reutilização de época é diagnosticada e não ressuscita o contador antigo.

Campos inválidos não viram zero. Entre duas amostras válidas da mesma série, um delta
pode ser recuperável apesar de falha intermediária; a lacuna é explicitamente marcada.
Não reconstruir perfil de uso, pulsos perdidos durante desligamento ou horário incerto.

## D1 — dia, mês e parcela pendente

O total do período é calculado diretamente dos intervalos, nunca somando máximos
diários ou acrescentando novamente o campo de pendência:

- Intervalo inteiro no período: entra exatamente uma vez.
- `distribution_pending_*`: parcela já incluída, mas ainda sem distribuição diária.
- `boundary_pending_*`: parcela não incluída, pois cruza a fronteira do período.
- IDs de contribuições permitem reconhecer o mesmo aviso em dois períodos vizinhos;
  não somar avisos de fronteira como se fossem consumos independentes.

Exemplo comprovado: 1 L atribuído a cada dia + 2 L entre dias = 4 L no mês, incluindo
2 L com distribuição diária pendente. Se chegar depois uma amostra exata na meia-noite,
o total continua 4 L e a divisão diária pode ser resolvida sem consumo adicional.

## Limitações explícitas

Todos os resumos permanecem `coverage: partial`. Sem critérios de completude física
aprovados, não promover dias a complete nem alimentar baseline homologada. A seleção
de baseline permanece no oráculo de contrato separado, com flags sintéticas.

Recomposição integral em memória: não é consolidação incremental distribuída,
transação de banco ou garantia de concorrência. Comparação de revisões, armazenamento,
retenção, fila offline, vigência de mudança de fuso e limites de atraso não foram
implementados. O fuso do acumulador é fixado na criação e não muda com o celular.

Números usam JavaScript e soma compensada em ordem estável, sem arredondamento de
exibição. Erros de ponto flutuante continuam possíveis; não é precisão faturável.
O envelope técnico rejeita resultados não finitos/excessivos. Inputs devem ser
payloads JSON acíclicos, sem funções ou instâncias de SDK.

Sem novos recursos, conexões ao Firebase, alterações no app/firmware, transferência,
migração, exclusão de dados, commit, push, merge ou deploy. A etapa seguinte depende
de orientação do usuário.
