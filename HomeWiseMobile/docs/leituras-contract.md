# Contrato de observação de leituras — orientação para Claude

Esta alteração remove apenas os fallbacks globais de `src/services/leiturasService.ts`.
Nenhuma tela, regra implantada ou configuração de produção foi alterada.

```ts
import type { FirestoreError } from 'firebase/firestore';

observarUltimaLeitura(
  callback: (leitura: Leitura | null) => void,
  dispositivoId?: string, // padrão: ''
  onError?: (error: FirestoreError) => void,
): () => void;

observarHistorico(
  callback: (leituras: Leitura[]) => void,
  limiteRegistros?: number | null, // padrão: 30; null mantém consulta sem limite
  dispositivoId?: string, // padrão: ''
  onError?: (error: FirestoreError) => void,
): () => void;
```

## Semântica

- Toda consulta mantém `where('dispositivo_id', '==', dispositivoId)`, ordenação
  descendente por `criado_em` e o limite anterior. Não existe consulta alternativa.
- Snapshot vazio chama o callback de dados com `null` (última) ou `[]` (histórico).
- Sem central ou com identificador em branco: mesmo resultado vazio, síncrono,
  sem consulta; retorna função de encerramento inócua.
- Erro de listener chama somente `onError(error)`, preservando o objeto original,
  incluindo `code` e `message`. Não chama o callback de dados nem inicia nova consulta.
- O callback de erro é opcional para preservar compatibilidade. Sem ele, o erro
  é registrado em `console.warn`, mas a tela não recebe um estado visual de falha.
- O erro encerra logicamente a assinatura; não há retry automático. Para tentar
  novamente, encerrar a assinatura antiga e criar outra explicitamente.
- O retorno chama o unsubscribe do Firestore e impede callbacks de dados/erro
  posteriores. Eventos após erro terminal também são descartados.
- A sincronização diária já existente continua no caminho de leitura recebida;
  não é disparada por resultado vazio, erro ou evento recebido após cancelamento.

## Adaptação do front-end (não implementada nesta tarefa)

`src/app/index.tsx`, `agua.tsx`, `energia.tsx` e `alertas.tsx` usam os dois serviços
sem callback de erro. Acrescentar o terceiro argumento à última leitura e o quarto
ao histórico:

```ts
const unsubLeitura = observarUltimaLeitura(onLeitura, dispositivoId, onErroLeitura);
const unsubHistorico = observarHistorico(onHistorico, null, dispositivoId, onErroHistorico);
// Manter ambos os unsubscribes no cleanup do useEffect.
```

Cada consumidor deve distinguir carregamento, sucesso vazio e erro. Limpar o erro
no início de uma nova assinatura e após dados recebidos; em erro, encerrar o estado
de carregamento e não apresentar falha como zero de consumo ou ausência de central.
Se mantiver dados anteriores, identificá-los como desatualizados. O botão de tentar
novamente deve recriar explicitamente a assinatura filtrada. Não adicionar fallback
global no front-end.

`src/app/metas.tsx` já passa `() => setFalha(dispositivoId)` como quarto argumento;
essa função permanece válida e agora recebe a falha diretamente, sem fallback.
Nenhuma mudança obrigatória de assinatura. Opcionalmente aceitar `error` para
apresentar mensagem específica.

`permission-denied` indica recusa de autorização. `failed-precondition` pode indicar
índice ausente, mas não deve ser apresentado como certeza de falta de índice sem
analisar a mensagem. Não mostrar a mensagem técnica bruta ao usuário final.
O índice composto esperado continua sendo `dispositivo_id ASC, criado_em DESC`;
esta tarefa não cria nem publica índices.

## Verificação local

```sh
node --test tests/leiturasService.test.cjs
```

Os testes transpilam o serviço com o TypeScript já instalado e substituem todas as
dependências em um contexto isolado. Imports inesperados são bloqueados; Firebase
real não é inicializado. Não validam regras ou índices implantados.
