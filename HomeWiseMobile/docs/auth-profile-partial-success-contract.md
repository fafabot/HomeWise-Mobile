# Cadastro e edição de perfil — contrato de conclusão e recuperação

Status atualizado em 06/11/2026: serviço, telas e contexto/guards integrados e
validados com mocks locais. Ver [auth-profile-session-flow.md](auth-profile-session-flow.md).
As seções abaixo preservam o contrato e o histórico da entrega do serviço.
Sem acesso a Firebase real, regras, firmware ou dados nesta etapa.
Branch `fix/auth-profile-partial-success`, worktree `HomeWise-Mobile-auth-profile-fix`,
base `origin/main` em `40dded4`. Sem commit, push, merge ou deploy.

## Causa comprovada

Antes da correção, salvarPerfilFirestore capturava a exceção de setDoc e retornava
false. cadastrarUsuario e atualizarPerfilUsuario ignoravam esse retorno e retornavam
sucesso true. Dois testes de regressão executados antes da mudança reproduziram
`true !== false`: falha de persistência no cadastro e na edição.

Agora ambos usam a persistência detalhada e só retornam sucesso completo depois de
confirmar os passos de Auth e Firestore. Não há transação distribuída entre os dois
produtos. Nenhuma tentativa de rollback por exclusão de conta/documento foi adicionada.

## Consumidores conferidos antes da mudança

| Consumidor | API e efeito |
|---|---|
| components/AuthScreen.tsx | cadastrarUsuario; já confere sucesso e erro, mas não distingue estado parcial nem oferece recuperação |
| app/editar-perfil.tsx | atualizarPerfilUsuario; sucesso false impede alerta de sucesso completo; ainda precisa de apresentação própria para parcial/retry |
| contexts/AuthContext.tsx | salvarPerfilFirestore para central/assinatura; mantém Promise<boolean> |
| components/ProfilePhoto.tsx | salvarPerfilFirestore para foto; mantém boolean e tratamento atual |
| app/metas.tsx | salvarPerfilFirestore para metas; mantém boolean; arquivo não alterado |
| mobile-guide/authService.js | módulo didático separado; não é o serviço TypeScript do aplicativo e não foi alterado |

Não alterar um consumidor booleano para testar a veracidade de um objeto de resultado:
`if (resultado)` aceitaria inclusive `{ sucesso: false }`. Usar sempre resultado.sucesso
nas APIs detalhadas. O wrapper legado continua booleano para impedir essa regressão.

## Retornos

### Persistência

- salvarPerfilFirestore(uid, dados): Promise<boolean>, compatível com os consumidores
  acima; delega ao método detalhado.
- salvarPerfilFirestoreDetalhado(uid, dados): Promise<PersistenciaPerfilResultado>.
  Sucesso: `{ sucesso: true }`. Falha: `{ sucesso: false, erro, codigo, causa }`.
  `causa` é o mesmo objeto lançado pelo SDK; `codigo` mantém o code original quando
  disponível. A mensagem é própria para o consumidor, sem exibir mensagem técnica crua.
  Não transformar o booleano legado em confirmação de operações Auth + Firestore.

### Cadastro, edição e recuperação

cadastrarUsuario e atualizarPerfilUsuario passam a retornar Promise<ResultadoPerfil>.
recuperarPerfilIncompleto usa o mesmo contrato. Campos comuns:

- `sucesso`: true somente com estado completo.
- `estado`: completo, parcial ou falha.
- `usuario`: identidade envolvida, quando conhecida; não inferir UID de campo do formulário.
- `etapas.conta`: criada, existente ou nao-confirmada.
- `etapas.auth` e `etapas.firestore`: confirmado, nao-confirmado ou nao-executado.
- `recuperavel`: há identidade conhecida para retomar; não garante sessão válida,
  rede, permissão ou que recuperarPerfilIncompleto sirva para repetir uma edição.
- Em falha/parcial: `erro`, `codigo`, `causa` e `etapaPendente` (conta, auth,
  firestore, sessao ou validacao).

“Não confirmado” significa que a operação não foi confirmada pelo SDK, não prova
que o servidor deixou de executá-la. “Falha” significa que nenhum passo de conclusão
foi confirmado nesta tentativa; nunca significa que conta/documento foram apagados.
Não colocar causa, senha, token ou objeto User em armazenamento/logs de interface.
`causa` é diagnóstico transitório para tratamento controlado, não texto ao usuário.

| Situação | estado / sucesso | Passos confirmados |
|---|---|---|
| Cadastro completo | completo / true | conta criada, Auth e Firestore |
| Conta criada, updateProfile rejeita | parcial / false | conta criada; Firestore não executado |
| Cadastro com setDoc rejeitado | parcial / false | conta criada e Auth; Firestore não confirmado |
| Edição com updateProfile rejeitado | falha / false | nenhuma alteração confirmada; Firestore não executado |
| Edição com setDoc rejeitado | parcial / false | Auth; Firestore não confirmado |
| Recuperação com transação rejeitada | falha / false | conta existente; Auth não executado |
| Recuperação com transação confirmada e Auth rejeitado | parcial / false | Firestore; Auth não confirmado |
| Recuperação repetida completa | completo / true | ambos; sem recriar conta ou regravar perfil completo |

## Preservação na edição

atualizarPerfilUsuario(nome, dadosExtras) aceita DadosEdicaoPerfil: dispositivo_id,
telefone, cpf, residencia, cep, cidade, estado e endereco_detalhado. Nome é fornecido
no primeiro argumento, aparado e aplicado consistentemente nos dois produtos.

UID/email, plano, assinatura, foto e metas não podem entrar por dadosExtras dessa
operação. Campos fora do conjunto retornam falha de validação antes de qualquer
updateProfile. Isso limita esta API; não é autorização de segurança para Firestore
e não substitui regras de produção.

Grava somente o patch permitido com merge. Campos undefined e mapa de endereço vazio
não são enviados; outros subcampos de endereço e campos alheios ficam preservados.
String vazia explícita continua sendo edição para limpar um campo textual permitido.
As APIs próprias de foto, metas e assinatura permanecem separadas e compatíveis.

## Recuperação idempotente de inicialização

recuperarPerfilIncompleto({ nome?, dispositivo_id? }) exige auth.currentUser com e-mail.
Não recebe senha nem UID e nunca chama createUserWithEmailAndPassword. A conta atual
determina o único documento usuarios/{uid}. Se perdeu a sessão, entrar nessa mesma
conta antes de retomar; não repetir cadastro para concluir um perfil.

1. Transação lê o documento, sem usar obterPerfilFirestore, que ainda retorna null
   tanto para ausência quanto para erro de leitura. Erro na transação nunca é tratado
   como autorização para sobrescrever documento ausente.
2. Preenche somente campos obrigatórios ausentes: uid, nome, email, dispositivo_id,
   criado_em. Central vazia representa nenhum vínculo; ID continua sem conceder acesso.
   Nome/central existentes prevalecem sobre novos defaults. UID/e-mail incompatíveis
   ou identificador de central com tipo inválido exigem revisão, sem sobrescrita.
3. Só grava quando há campo a preencher; mantém criado_em e atualizado_em em repetições
   sem mudanças. set com merge preserva os demais campos. Retries da transação não
   contêm efeitos no Auth.
4. Depois da confirmação da transação, confirma o displayName no Auth usando o nome
   persistido. Se falhar, retorna parcial e permite repetir sem nova gravação do perfil.

Esta API inicializa perfil incompleto. **Para repetir edição parcial, reenviar a mesma
edição para atualizarPerfilUsuario**, preservando os valores do formulário. Não usar
recuperarPerfilIncompleto para aplicar mudanças a um perfil já completo: o nome já
existente no Firestore prevalece nessa recuperação e pode sincronizar o Auth para ele.
Não existe resolução automática de intenções de edições concorrentes nesta tarefa.

## Ajustes necessários para Claude — não implementados nas telas

> Atualização (06/11/2026): os itens 1 a 4 foram implementados nas telas e no
> contexto. O item 5 foi respeitado. O contrato do serviço continua idêntico (mesmo
> SHA-256). Ver [auth-profile-front-end-handoff.md](auth-profile-front-end-handoff.md#estado-final-do-front-end--06112026)
> e [auth-profile-session-flow.md](auth-profile-session-flow.md). A frase
> "a tarefa integrada de interface ainda não está concluída", no fim desta seção,
> descreve o estado da época.

1. AuthScreen: distinguir parcial de falha, manter os dados necessários em memória e
   oferecer conclusão na mesma conta; não orientar nova criação nem guardar senha.
2. AuthContext/Navigation: criação da conta dispara onAuthStateChanged antes de terminar
   o cadastro. O contexto atual pode navegar para o app e usa um perfil substituto em
   memória se o documento não existe. Esse substituto não comprova persistência.
   Expor estado explícito de perfil pendente/erro e controlar navegação antes de
   declarar onboarding completo. Não criar documento por efeito colateral silencioso.
3. Editar perfil: manter dados após parcial; explicar o que foi confirmado e oferecer
   repetição da edição. Usar erro como mensagem; codigo/etapaPendente para decisão.
4. Ignorar respostas de sessão/UID anterior em consumidores assíncronos. As operações
   do serviço mantêm UID capturado e conferem sessão antes de novas gravações.
5. Não adaptar foto/metas/assinatura para a API detalhada sem tratar seu contrato
   explicitamente. Não misturar telemetria v2, SVG de Metas ou mudanças visuais.

As telas não foram alteradas por solicitação do usuário. Logo a correção do serviço
está preparada, **mas a tarefa integrada de interface ainda não está concluída**.

## Validação e limites

Mocks executam o TypeScript real em vm com imports permitidos explicitamente. Não
inicializam Firebase SDK/configuração, contas reais ou emuladores. Cobrem os sete
cenários solicitados, códigos/causas originais, ambos os sentidos de parcial,
idempotência, retry de transação, troca de sessão, rejeição de campos protegidos,
preservação de mapas/timestamps e compatibilidade booleana.

```powershell
node --test tests/authService-profile.test.cjs
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
```

26 testes novos e 107 testes totais aprovados. Tipos e lint também aprovados.
Dependências existentes foram reutilizadas por junction
local ignorada, com lockfiles idênticos por hash; sem instalação/atualização de pacotes.

Não homologa regras/índices reais, permissões transacionais, concorrência distribuída,
offline, erro de confirmação após commit remoto, sessão nativa ou navegação real.
Transações de recuperação dependem de leitura e escrita permitidas pelas regras e
de conexão; nenhuma regra foi alterada. Auth e Firestore não se tornam atômicos.

Referências: [usuários Auth](https://firebase.google.com/docs/auth/web/manage-users),
[transações e retries](https://firebase.google.com/docs/firestore/manage-data/transactions),
[merge e campos aninhados](https://firebase.google.com/docs/firestore/manage-data/add-data).
