# Histórico diário: contrato de erro e orientação para Claude

```ts
import type { FirestoreError } from 'firebase/firestore';

observarHistoricoDiario(
  callback: (historico: ConsumoDiario[]) => void,
  dispositivoId: string,
  limiteDias?: number, // padrão 366, comportamento anterior preservado
  onError?: (error: FirestoreError) => void,
): () => void;
```

Os três parâmetros anteriores permanecem nas mesmas posições. A consulta continua
filtrada por `dispositivo_id`; conversão, ordenação e corte em memória não mudaram.
Esta tarefa não altera cálculos, agregação, telas, hooks ou produção.

## Resultados, erros e encerramento

- Snapshot vazio legítimo chama `callback([])`; não representa erro.
- Sem central ou com identificador em branco, chama `callback([])` imediatamente,
  sem consulta, e retorna cleanup inócuo.
- Erro chama `onError` com o objeto `FirestoreError` original, sem callback de dados.
  Não substitui dados anteriores por uma lista vazia nem garante sua atualização.
- A falha é registrada via `console.warn` com código e mensagem, seguindo o padrão
  de `leiturasService`, inclusive quando `onError` é omitido. Nesse caso, não há
  notificação visual automática: o consumidor precisa fornecer o callback.
- Erro encerra a assinatura antes de notificar o consumidor, sem retry ou fallback.
  Eventos posteriores de dados/erro são descartados.
- O retorno encerra a assinatura de forma idempotente: chamar várias vezes, inclusive
  após erro, libera o recurso no máximo uma vez e descarta eventos tardios.
- Uma nova tentativa exige criar outra assinatura explicitamente.

## Consumidores a adaptar (nenhum editado nesta tarefa)

Os quatro consumidores diretos encontrados no estado local são:

| Arquivo | Chamada atual |
|---|---|
| `src/app/index.tsx` | `observarHistoricoDiario(callback, dispositivoId)` |
| `src/app/agua.tsx` | `observarHistoricoDiario(callback, dispositivoId)` |
| `src/app/energia.tsx` | `observarHistoricoDiario(callback, dispositivoId)` |
| `src/app/alertas.tsx` | `observarHistoricoDiario(callback, dispositivoId)` |

Acrescentar o quarto argumento, usando `undefined` no terceiro para preservar 366:

```ts
const unsubDiario = observarHistoricoDiario(
  onDadosDiarios,
  dispositivoId,
  undefined,
  onErroDiario, // (error: FirestoreError) => void
);
// Manter unsubDiario no cleanup do useEffect.
```

Claude deve manter estados distintos para carregando, pronto (inclusive vazio) e
erro da fonte diária, vinculados ao usuário e central atuais. Ao receber erro,
encerrar carregamento e marcar quaisquer dados mantidos como desatualizados.
Limpar o erro ao iniciar outra assinatura e ao receber dados válidos. Uma tentativa
manual deve recriar também a assinatura diária, mantendo o filtro de central.

O hook local `useLeiturasCentral` acompanha somente última leitura e histórico bruto;
seu status de sucesso e seu retry não abrangem a consulta diária. Nenhuma alteração
nesse hook foi feita nesta tarefa.

**Dados brutos disponíveis não comprovam que o histórico combinado esteja completo
quando a consulta diária falha.** Os resumos podem conter dias/valores ausentes dos
brutos disponíveis. As quatro telas não devem apresentar totais, comparativos ou
baseline derivados dessa combinação como completos/confiáveis durante a falha.
Se exibirem uma estimativa parcial, devem identificá-la explicitamente. Isso é uma
adaptação de apresentação/estado para Claude, não uma alteração dos cálculos aqui.

## Testes locais

```sh
node --test tests/baselineService.test.cjs tests/leiturasService.test.cjs
```

Dependências do serviço são substituídas em contexto isolado e imports inesperados
são bloqueados. Firebase real não é inicializado; não há escrita ou consulta real.
Estes testes não comprovam índices, regras ou disponibilidade da produção.
