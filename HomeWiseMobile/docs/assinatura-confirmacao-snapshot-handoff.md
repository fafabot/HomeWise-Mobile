# Confirmação de assinatura × snapshots do perfil: alinhamento com o Codex

Branch `feat/assinatura-confirmacao-sucesso`, base `a3b0c8d` (`main`), sem commit.
Este documento registra a análise antes de qualquer mudança na lógica de sessão.
Nenhum service, `AuthContext` ou regra foi alterado.

## Como a tela decide o plano exibido

Em `src/app/gerenciar-assinatura.tsx` (linhas 62–67), depois de
`atualizarPlanoAssinatura` retornar `true`, a tela guarda
`{ planoId, ciclo, perfilBase }`, em que `perfilBase` é o objeto `perfil` atual.
Enquanto o contexto publicar esse mesmo objeto, o cartão "Sua assinatura atual"
mostra o plano confirmado. **Qualquer outro objeto `perfil`** volta a ser a fonte
do cartão.

Pela identidade do objeto, a tela não distingue um snapshot mais novo (por exemplo,
um cancelamento feito em outro aparelho) de um snapshot com dados mais antigos.

## Resultado da verificação

Experimento temporário com o harness de `tests/gerenciar-assinatura-confirmacao.test.cjs`
(contexto falso, sem SDK), simulando as sequências abaixo:

| Caso | Sequência | Cartão observado |
|---|---|---|
| B | sucesso → contexto publica objeto novo com o plano anterior → snapshot correto | Plus → **Sem plano contratado** (com a confirmação "Plus ativado" ainda visível) → Plus |
| A (`AuthContext` da `main`) | eco local com o plano novo → servidor rejeita → `false` | **Plus + Cancelar com o checkout ainda aberto** → Sem plano + erro |
| C (`AuthContext` do Codex) | eco pendente ignorado → `true` → snapshot do servidor | Sem plano → Plus → Plus |

### 1. Um snapshot antigo pode substituir o plano confirmado? Na tela, sim; nos contextos atuais, não foi encontrado caminho

- A tela aceita qualquer perfil novo (caso B). Isso mostra temporariamente o plano
  anterior e contradiz a confirmação.
- No `AuthContext` da `main`, `onSnapshot` não usa `includeMetadataChanges`. A
  gravação usa `setDoc(..., { merge: true })` e só resolve após o servidor.
  - Pela compensação de latência do SDK, a escrita local já aparece no snapshot
    antes do `true`.
  - Snapshots remotos posteriores trazem a escrita pendente sobreposta.
  - Nenhum outro gravador envia `plano`, `ciclo_assinatura` ou `status_assinatura`:
    metas, foto, cadastro, edição e preferências são gravações parciais com merge.
  - `atualizarPreferenciasNotificacoes` usa atualização funcional sobre o perfil
    mais recente.
  - O fallback de documento inexistente só ocorre sem documento.
- No `AuthContext` do Codex (`fix/auth-profile-partial-success`, não integrado):
  - snapshots `fromCache` e `hasPendingWrites` são ignorados, mantendo o mesmo objeto;
  - o próximo `setPerfil` vem do servidor, já com a escrita (caso C);
  - não foi encontrado caminho que republique dados anteriores.

Conclusão: **hoje a garantia depende do contexto e do SDK, não da tela.** Esta
análise usou leitura de código e simulação; não foram testados Firebase real,
emulador, várias abas, persistência offline ou rede instável.

### 2. Problema real encontrado no contexto da `main`: eco não confirmado (caso A)

Com o `AuthContext` da `main`, o eco local da escrita é publicado como `perfil`
antes da confirmação.

- **Durante o processamento:** o cartão atrás do checkout já mostra o plano novo e
  o botão Cancelar.
- **Em falha:** o SDK reverte e a tela mostra o erro, mas por um instante o plano
  pareceu ativo.
- **Sem conexão:** o `setDoc` web pode ficar pendente. O checkout fica em
  "Processando pagamento…", com o fechar desativado, e o cartão já mostra o plano.
  Se a conexão voltar com o app aberto, a escrita pode ser concluída depois, sem a
  confirmação da tela. Com cache em memória, a escrita pendente se perde ao fechar.

O contexto do Codex não tem esse comportamento, porque ignora snapshots com
escritas pendentes.

## Pedido de alinhamento ao Codex (sem alteração feita)

1. Confirmar como contrato do `AuthContext` integrado: depois de uma gravação
   confirmada, o contexto nunca publica um `perfil` com dados anteriores a ela.
   Isso vale inclusive para reinício de listener, `tentarNovamentePerfil`, cache,
   persistência e várias abas.
2. Se esse contrato não puder ser garantido, definir um sinal monotônico de versão
   para a tela comparar, sem depender da identidade do objeto. Opções: `serverTimestamp`
   em `atualizado_em`/`assinado_em`, ou um contador de versão. Hoje esses campos usam
   `new Date()` do cliente, que não é confiável para ordenar.
3. Decidir se a integração do contexto do Codex na `main` resolve o caso A, ou se a
   `main` deve deixar de publicar ecos pendentes antes disso.
4. Definir o comportamento para escrita pendente sem conexão: tempo-limite,
   possibilidade de fechar o checkout e como informar uma ativação concluída depois.
   Isso envolve service/contrato e fica com o Codex.

Depois do alinhamento, a mudança de tela prevista é pequena: manter o plano
confirmado até chegar um `perfil` com versão igual ou posterior, e não apenas até
o próximo objeto. Ela só será feita com o sinal acordado no item 2.
