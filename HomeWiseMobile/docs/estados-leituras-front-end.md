# Estados de leituras no front-end

`src/hooks/use-leituras-central.ts` concentra as assinaturas de última leitura,
histórico bruto e histórico diário usadas por `index`, `agua`, `energia` e `alertas`
(`useLeiturasCentral`) e o histórico bruto de `metas` (`useHistoricoCentral`).
Os contratos consumidos estão em `leituras-contract.md` e `historico-diario-contract.md`.

## Regras

- Cada fonte tem estado próprio: `carregando`, `pronto` (inclusive vazio) ou `erro`.
  O sucesso de uma fonte não apaga o erro de outra.
- Trocar usuário ou central abre uma nova sessão e descarta dados e erros anteriores,
  inclusive em A → B → A. Callbacks de sessões anteriores são ignorados.
- "Tentar novamente" só existe por ação do usuário e recria apenas as assinaturas com
  erro. Dados recebidos antes do erro continuam visíveis e marcados como desatualizados.
- Não há repetição automática nem fallback no front-end.

## Dependências dos indicadores

| Indicador | Fontes |
|---|---|
| Valores instantâneos, status ao vivo, alertas de vazamento/pico/tensão | última leitura |
| Gráfico de barras de energia (potência média) | histórico bruto |
| Gráfico de barras de água (consumo em L por período, `montarBarrasConsumo`) | histórico bruto + diário |
| Consumo por período, custo previsto, médias, previsão e linha de base | histórico bruto + diário |
| Metas (fórmula inalterada) | histórico bruto |

`disponibilidade(...fontes)` devolve `indisponivel` (erro sem dados), `carregando`,
`desatualizado` (erro com dados anteriores) ou `ok`. Indicadores só são exibidos em
`ok` ou `desatualizado`; nos demais casos mostram `--` ou mensagem de indisponibilidade.

## Testes

Na pasta `HomeWiseMobile`:

```sh
npm test                                        # todos os tests/*.test.cjs
node --test tests/useLeiturasCentral.test.cjs   # somente o hook
```

Os testes do hook usam o React do projeto e `react-test-renderer@19.3.0`
(devDependency fixada na mesma versão de `react`), com services substituídos por fakes.
Não validam layout, navegação, regras do Firestore, índices nem Firebase real.
