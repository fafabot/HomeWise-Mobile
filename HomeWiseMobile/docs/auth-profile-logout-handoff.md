# Saída unificada — entrega para o Claude

Atualização (06/11/2026): saída validada no navegador com mocks, sempre em
Boas-vindas, pelo Perfil (após cadastro, recuperação e login) e pela conclusão de
perfil. Esta incluiu falha de saída e nova tentativa. Na conclusão, "Sair da conta"
virou botão com estado "Saindo…", e o botão voltar desativado foi removido. A API
`sairDaConta`/`saindo`/`erroSaida` não mudou. Suíte atual: 172 testes. Ver
[auth-profile-front-end-handoff.md](auth-profile-front-end-handoff.md#estado-final-do-front-end--06112026).

Branch `fix/auth-profile-partial-success`, worktree separado
`HomeWise-Mobile-auth-profile-fix`, base `40dded47dd11e61220eb770c71c4e89a9caf6f48`.
Sem commit. Alterações anteriores preservadas. Edições pausadas após esta entrega.

## Causa e correção

O Perfil chamava `deslogarUsuario()` diretamente. O callback do Auth limpava o
usuário, mas mantinha `entry` com login/cadastro; o destino dependia da origem da
sessão. A conclusão de perfil usava `sairDaConta()`, que limpava também a entrada,
criando comportamentos diferentes. Além disso, remover a autorização das rotas
assim que `saindo` era marcado desmontava a tela antes de conhecer o resultado.

Agora os dois consumidores usam `AuthContext.sairDaConta()`. A limpeza idempotente
`concluirSaida()` centraliza usuário, perfil, referências de confirmação, operações,
erros, formulário e `entry = null`. Ela é acionada tanto pelo callback confirmado
de sessão nula durante a saída quanto pelo retorno confirmado do SDK. Os guards
existentes deixam somente `boas-vindas` acessível, independentemente da origem da
sessão. Não há `router.replace`, `push` ou redirecionamento concorrente no logout.

O Perfil usa `saindo` e `erroSaida` do contexto. Mantém o modal e os estilos
existentes e apresenta mensagem própria em falha, sem erro técnico. A tela normal
permanece montada enquanto a saída está em andamento e se falhar com sessão ativa.
A trava síncrona é do contexto. Os listeners invalidados são renovados após falha.

Callbacks de Auth incompatíveis com `auth.currentUser` são descartados. A geração
de sessão invalida listeners/reloads/operações e também respostas tardias do próprio
logout; uma rejeição antiga não coloca erro numa nova conta. A proteção anterior
contra recriação tardia após logout permanece, incluindo falha ao rejeitá-la.

## Contrato e consumidores

- `sairDaConta(): Promise<void>` preservado: erros tratados pelo contexto, através
  de `erroSaida`; a resolução da Promise isoladamente não afirma sucesso.
- Sucesso significa sessão efetivamente nula. Se a Promise rejeitar mas o SDK já
  confirmar sessão nula, conclui a saída; se continuar ativa, mantém a conta e erro.
- `saindo` bloqueia reenvio no Perfil; recuperação também usa a mesma API.
- `deslogarUsuario()` permanece como wrapper de baixo nível por compatibilidade;
  não tem consumidores em `src` após a correção. Não usá-lo em novas telas: ele não
  coordena estado e navegação. Serviço e testes de serviço não foram modificados.
- `src/app/_layout.tsx` e `AuthScreen.tsx` não precisaram de novas alterações nesta
  etapa: já consomem os estados/guards apropriados.

## Arquivos desta etapa

- `src/contexts/AuthContext.tsx`
- `src/app/perfil.tsx`
- `tests/auth-session-flow.test.cjs`
- Este relatório e referência no relatório de sessão.

## Validação — PowerShell

Na pasta `HomeWise-Mobile-auth-profile-fix\HomeWiseMobile`:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist
```

158 testes passaram, incluindo nove novos: Perfil e conclusão de perfil para cada
origem (login/cadastro/restauração), falha com sessão ativa e duplicação, callbacks
Auth antigos e rejeição tardia do logout após entrada em outra conta. Os testes
renderizam Perfil, provider e guards reais com mocks isolados nas fronteiras SDK.
Nenhum acesso ao Firebase real ou abertura de página externa.

Tipos, lint sem cache, suíte completa de 158 testes, build web local e
`git diff --check` aprovados. Serviço e seus 26 testes preservados por SHA-256,
conforme o relatório de sessão. O build em `dist` não foi publicado.

Limitações: mocks não homologam persistência do SDK em dispositivos nem navegação
visual no navegador. `react-test-renderer` emite aviso de depreciação. Logout não
cancela requisições já recebidas pelo servidor; suas respostas são invalidadas na UI.

Sem produção, contas reais, alteração de dependências, telemetria v2 ou SVG de Metas.
Sem commit, push, merge ou deploy. Claude pode continuar a partir destes arquivos;
esta etapa não mantém edições ou processos de validação em andamento após a entrega.
