# Conclusão integrada de cadastro e perfil

Atualização final de front-end (06/11/2026): na conclusão de perfil não há botão
voltar, as senhas ficam ocultas e a saída é o botão "Sair da conta". Editar perfil
mantém um aviso persistente, sem alerta nativo redundante no web. Suíte atual: 172
testes. Contratos e lógica de sessão deste documento não mudaram. Ver
[auth-profile-front-end-handoff.md](auth-profile-front-end-handoff.md#estado-final-do-front-end--06112026).

Atualização posterior: saída pelo Perfil e pela conclusão unificada em Boas-vindas.
Ver [auth-profile-logout-handoff.md](auth-profile-logout-handoff.md) para a correção
e a validação posterior de 158 testes. Os resultados de 149 abaixo registram esta
etapa anterior de integração.

Worktree `HomeWise-Mobile-auth-profile-fix`, branch
`fix/auth-profile-partial-success`, base `40dded47dd11e61220eb770c71c4e89a9caf6f48`.
Alterações locais, sem commit. Este documento atualiza o bloqueio do handoff
anterior, sem modificar o contrato do serviço ou seus testes.

## Critérios e contrato para o front-end

- `user` significa sessão autenticada. Não comprova perfil completo.
- `estadoPerfil`: `sem-sessao`, `verificando`, `ausente`, `incompleto`, `erro` ou
  `completo`. Ausência só é afirmada por snapshot de servidor; erro de consulta
  ou de restauração do Auth continua erro. Não se cria perfil substituto em memória.
- `perfilConcluido` é o único sinal para liberar as rotas normais e a barra inferior.
  Exige documento confirmado pelo servidor (sem pending writes/cache), UID e e-mail
  correspondentes, nome não vazio e confirmação do Auth. Na restauração, `reload`
  consulta o Auth e o nome deve conferir com o perfil. Central, telefone, endereço,
  CPF, plano, foto, timestamps e verificação do e-mail não são requisitos desse fluxo.
- `iniciarOperacaoPerfil(email)` retorna token ou `null` quando bloqueado. Chamar
  imediatamente antes de cadastro/recuperação. A trava é síncrona e impede duplicação.
- `finalizarOperacaoPerfil(token, resultado)` deve ser chamado mesmo se a tela
  desmontar. No `finally`, finalizar sem resultado em exceção. Tokens antigos são
  ignorados. Completo requer `sucesso`, `estado` e ambas as etapas confirmadas,
  com UID da sessão atual; ainda é necessário confirmar o documento no servidor.
- Durante a operação composta, snapshot sozinho não libera o app. Parcial ou
  exceção com conta existente mantém recuperação, mesmo se uma consulta posterior
  encontrar campos preenchidos. Repetir consulta não equivale a concluir a operação.
- `tentarNovamentePerfil()` refaz as consultas de leitura, sem criar conta/perfil.
  A UI diferencia espera, ausência, incompletude e erro com mensagens próprias.
- `sairDaConta()` está disponível no fluxo incompleto, inclusive durante a operação.
  Sucesso limpa sessão/perfil/formulário. Falha mantém a conta e permite nova tentativa.
  Resposta tardia não desfaz a saída nem navega. Logout não cancela operações já
  recebidas pelo servidor; não há rollback ou exclusão automática.
- A criação esperada adota somente a própria conta, mantendo a instância do formulário.
  Troca efetiva de usuário renova `chaveFormulario`, elimina o rascunho anterior e
  invalida callbacks de listeners, reloads e operações anteriores, inclusive A→B→A.
- Após restauração com perfil ausente/incompleto, cadastro torna-se recuperação:
  `Concluir meu perfil` usa a mesma conta, sem senha ou nova chamada de criação.
  Não são renderizados `causa`, mensagem do SDK ou diagnóstico técnico.
- A sessão já validada permanece utilizável durante alterações de nome e echoes
  locais pendentes, para preservar a edição preparada anteriormente. Essas alterações
  continuam dependendo de `ResultadoPerfil` para apresentar sucesso; não se perde o
  rascunho nem se considera um resultado parcial totalmente salvo.

## Arquivos desta etapa

- `src/contexts/AuthContext.tsx`: estados, confirmação de servidor/Auth, coordenação,
  isolamento por sessão, consulta novamente e saída.
- `src/app/_layout.tsx`: guard de recuperação independente de presença de usuário;
  acesso normal condicionado a perfil confirmado.
- `src/app/cadastro.tsx`: identidade do formulário por sessão lógica.
- `src/components/AuthScreen.tsx`: ligação dos tokens, recuperação após restauração,
  consulta novamente e saída, com os componentes/estilos existentes.
- `tests/auth-session-flow.test.cjs`: provider, guards e formulário reais com todas
  as fronteiras Firebase substituídas por mocks; imports inesperados são negados.
- `tests/profile-front-end.test.cjs`: preservação da suíte anterior; reprodução do
  guard defeituoso substituída por aceitação da correção e mocks da nova API.

O serviço, seus 26 testes e a edição de perfil preparada anteriormente foram
preservados. Telemetria v2 e SVG de Metas não foram incorporados.

## Validação reproduzível — PowerShell

Na pasta `HomeWise-Mobile-auth-profile-fix\HomeWiseMobile`:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist
```

Casos: completo, parcial, recuperação, falha e exceção; Auth/snapshot em ordens
diferentes; primeiro callback atrasado; recarga/restauração completa ou ausente;
erro de leitura distinto de ausência; cache e gravações pendentes; campos opcionais;
nome pendente no Auth; troca de contas e callbacks obsoletos; travas de envio;
saída com sucesso/falha; manutenção da edição durante atualização de nome.

## Limitações

- Mocks validam a coordenação local, não permissões reais, rede, SDK em dispositivo
  ou homologação visual. Nenhum emulador, conta real ou conexão Firebase foi usado.
- Sem rede, uma sessão nova aguarda confirmação; o cache não libera acesso normal.
  As consultas do app em uso real dependem de conectividade e permissões, e podem
  ter custos de leitura. Não foram alterados projeto, faturamento ou regras.
- Formulários preservam dados enquanto montados; recarga total perde o rascunho em
  memória. Retoma-se a conta autenticada e os dados persistidos; senha não é guardada.
- Conclusão local não substitui autorização no servidor. A lógica de plano e regras
  de produção não foi alterada. Não há transação distribuída Auth/Firestore.
- Não há garantia de cancelamento de requisições já em trânsito ao sair da conta;
  suas respostas não podem atualizar a interface de uma sessão posterior.
- `react-test-renderer` emite aviso de depreciação. Build é exportação local, sem deploy.

## Resultados locais

- 149 testes passaram: 23 novos de sessão integrada, 19 de front-end, 26 do serviço
  e 81 testes já existentes. Nenhuma falha, cancelamento ou teste ignorado.
- TypeScript sem emissão e sem incremental: aprovado.
- Lint sem cache: aprovado, sem warnings.
- Exportação web: aprovada em `dist`, sem publicação.
- `git diff --check`: aprovado (Git apenas informa normalização futura LF/CRLF).
- SHA-256 do serviço preservado:
  `5ACAD89695400453ED298B22CC44C52ACAB68A50317BB65F8187BB04463239C1`.
- SHA-256 dos 26 testes do serviço preservado:
  `747835503D76F17CEB5BE8688F4FA41D5054A3D8F177F417F31291ECFA0AEDD6`.

Sem alteração de dependências, contas/dados/regras reais, recursos pagos, firmware,
commit, push, merge ou deploy. Aguardar revisão antes de qualquer próxima etapa.
