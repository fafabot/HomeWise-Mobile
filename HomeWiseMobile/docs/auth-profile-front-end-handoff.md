# Front-end de cadastro/perfil — entrega e encaminhamento ao Codex

Worktree HomeWise-Mobile-auth-profile-fix, branch fix/auth-profile-partial-success,
base 40dded4. A edição anterior do serviço estava pausada no início desta etapa.
Contrato e implementação lidos antes de editar. Serviço e seus 26 testes mantidos
byte a byte; AuthContext e _layout também preservados por hash.

**Atualização de 06/11/2026: bloqueio de contexto/guards corrigido nesta mesma
branch e worktree, sem commit. Fluxo integrado validado com mocks locais.
O comportamento final das telas está em "Estado final do front-end", logo abaixo.**
Os detalhes abaixo descrevem a entrega anterior e o problema então encaminhado.
A resolução atual e os critérios para os consumidores estão em
[auth-profile-session-flow.md](auth-profile-session-flow.md).

## Estado final do front-end — 06/11/2026

Esta seção descreve o comportamento vigente. As seções seguintes são histórico.
Só telas e testes de tela mudaram nesta etapa: `authService.ts` (SHA-256 `5ACAD896…239C1`, igual ao do relatório de sessão),
`AuthContext.tsx`, `_layout.tsx`, `cadastro.tsx`, `perfil.tsx` e os testes de
serviço e de sessão continuam como o Codex os deixou. Nenhum contrato foi alterado.

### Conclusão de perfil (`AuthScreen`, modo cadastro)

- Entra em modo de conclusão quando há cadastro parcial nesta montagem ou sessão
  restaurada/login com perfil pendente. Um cadastro novo em andamento que já recebeu
  a sessão continua com aparência de cadastro até o resultado.
- Textos: "CONCLUSÃO DO PERFIL", "Conclua seu perfil" e explicação de que a conta já
  existe, sem criar outra conta nem informar a senha. Senha, "Esqueceu sua senha?" e
  Confirmar senha ficam ocultos; o cadastro normal e o login não mudam.
- Sem rascunho da central (recarga ou login), um aviso informa que o código não foi
  mantido e pode ser vinculado depois em Editar perfil. Nada é persistido para guardar
  rascunho; senha nunca é armazenada.
- Não há botão voltar nesse modo (antes ficava visível e desativado). A saída é o
  botão "Sair da conta", abaixo de "Concluir meu perfil", com nota de que é possível
  entrar depois e concluir na mesma conta. Usa `sairDaConta()` do contexto: mostra
  "Saindo…" e fica desativado enquanto `saindo`; `erroSaida` exibe mensagem com
  `role="alert"`. Sucesso leva às boas-vindas pelos guards existentes.

### Editar perfil

- Parcial, falha ou exceção deixam um aviso persistente acima de "Salvar Alterações"
  (âmbar para parcial, vermelho para falha; `role="alert"` e região viva). Os campos
  são mantidos. Na nova tentativa o aviso vira "Tentando salvar novamente…" e depois
  mostra o novo resultado com "Resultado da tentativa N". Some no sucesso completo.
- Alertas: no nativo, parcial/falha também abrem `Alert.alert`. No web não há
  `window.alert` para parcial/falha (seria redundante e bloqueante); o aviso na tela
  é a comunicação. A confirmação de sucesso continua nos dois e é ela que navega para
  o Perfil.
- Rolagem: quando o aviso surge ou muda, se o rodapé (aviso + botão) estiver fora
  da área visível a tela rola até o fim, uma vez por resultado. Digitar ou mudar o
  layout depois não provoca nova rolagem.
- Teclado: o conteúdo fica num `KeyboardAvoidingView` (`padding` no iOS, `height`
  no Android, mesmo padrão do `AuthScreen`), para aviso e botão continuarem
  alcançáveis acima do teclado e da barra inferior.

### Validação desta etapa

- `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform web` e
  `git diff --check` aprovados.
- **172 testes, 172 aprovados.** Por arquivo: sessão 32, serviço 26, front-end 33,
  demais 81.
- Histórico da contagem: 107 (serviço), 126, 149 (sessão integrada), 158 (saída
  unificada), 162 (ajustes de conclusão/aviso) e 172 (esta etapa).
- Os +10 desta etapa:
  - variantes nativo/web da edição;
  - exceção na edição;
  - rolagem com o aviso fora e dentro da área visível;
  - `KeyboardAvoidingView`;
  - conclusão sem voltar e com saída;
  - login com voltar.
- As antigas asserções de alerta em parcial/falha valem agora para o nativo. No web,
  a asserção passou a ser ausência de alerta e presença do aviso: é uma mudança de
  comportamento pedida, não uma regressão aceita.
- Navegador com Firebase substituído por mocks (sem rede externa), em celular 390×844,
  área de 500 px simulando teclado e desktop 1280×800:
  - cadastro;
  - conclusão e recuperação;
  - recarga;
  - login pendente;
  - edição parcial → falha → sucesso;
  - saída com falha e nova tentativa;
  - logout pelo Perfil após cadastro, recuperação e login.
- Nenhum diálogo do navegador além das confirmações de sucesso. Sem erros de console;
  só o aviso conhecido de `useNativeDriver` no web.

### Limitações conhecidas

- Teclado real não foi testado: no web a área menor foi simulada, e iOS/Android não
  foram executados.
- No Android, com edge-to-edge, o comportamento de `KeyboardAvoidingView` depende do
  modo de teclado do aparelho. A barra inferior não se esconde com o teclado aberto,
  nem antes nem agora.
- No web, leitores de tela dependem de `role="alert"`. O foco não é movido para o
  aviso.
- A rolagem automática roda só uma vez por resultado. Se o usuário rolar para longe
  durante uma gravação demorada, ela pode trazê-lo de volta ao rodapé, de propósito.
- Mocks não cobrem Firebase real, regras, rede, latência real nem dispositivos.

## Histórico: o que foi implementado na primeira entrega

- AuthScreen só trata cadastro/recuperação como completo com sucesso true e estado
  completo. Parcial explica que a conta existe e que o perfil precisa ser concluído.
- O mesmo botão aprovado passa a “Concluir meu perfil” após parcial. Retentativas
  chamam recuperarPerfilIncompleto com nome/central, nunca cadastrarUsuario ou senha.
- Nome, e-mail, central e senhas permanecem na memória do formulário. Após parcial,
  campos ficam bloqueados para não mudar a identidade/intenção da recuperação.
  Nenhuma senha, token, User ou causa é gravada em armazenamento/logs.
- Ausência ou mudança de UID impede tentativa de recuperação com outra conta.
  Não há criação alternativa, logout automático ou alteração dos guards.
- Edição só apresenta sucesso e botão OK de navegação após conclusão completa.
  Parcial e falha deixam a tela aberta, com dados preservados para reenviar a mesma
  edição. Não usar recuperação de inicialização para aplicar edição parcial.
- Rascunho editado não é sobrescrito por snapshots posteriores do perfil. Campos
  ficam temporariamente não editáveis durante envio. Consulta CEP pendente é
  invalidada ao salvar, para não trocar o endereço do rascunho durante a gravação.
- Travas síncronas por ref bloqueiam cliques repetidos e Enter + clique antes de
  rerender. Exceções liberam o envio e não vazam mensagens técnicas. Respostas de
  sessão antiga ou componente desmontado não mostram sucesso nem navegam.
- profile-feedback.ts usa texto próprio para o usuário, nunca resultado.erro,
  causa.message, stack ou JSON do SDK. Erros de login conhecidos são traduzidos
  por authErrorMessage. Diagnósticos continuam preservados no serviço.

O visual-base, componentes, estilos, imagens e navegação aprovada foram preservados;
mudanças visuais limitam-se a mensagens e rótulo/estado do botão no fluxo incompleto.

## Histórico: bloqueio reproduzido na entrega anterior (agora corrigido)

Em AuthContext.tsx, onAuthStateChanged publica user antes da conclusão de cadastro.
Em _layout.tsx, cadastro é protegido por !user && entry === 'cadastro'; as rotas do
app são liberadas por !!user && !!entry. Assim, a conta recém-criada remove a tela
de cadastro antes de ela poder apresentar parcial/recuperação.

O contexto ainda constrói um perfil substituto em memória se o documento não existe.
Esse objeto não comprova persistência. Uma transação de recuperação pode confirmar
Firestore antes de confirmar o nome no Auth: nem mesmo um snapshot de perfil completo,
isoladamente, é sinal de que a operação composta terminou.

O teste “guard atual remove cadastro ao receber usuário: bloqueio documentado para
Codex” executa Navigation real com Stack/contexto simulados e confirma essa remoção.
Ele é uma reprodução da pendência, não uma asserção de comportamento desejável final.

## Histórico: ajuste solicitado ao Codex (resolvido nesta etapa)

1. No contexto, representar explicitamente perfil validando/pendente/completo/erro
   e separar perfil persistido de perfil substituto. Erro de leitura não é ausência
   nem perfil confirmado. Descartar snapshots/respostas de UID ou sessão anterior.
2. Coordenar operação composta de cadastro/recuperação: marcar em andamento ANTES
   da chamada ao serviço e só finalizar com ResultadoPerfil completo. Parcial mantém
   pendência. Snapshot de Firestore não deve antecipar a conclusão do Auth.
3. Manter cadastro/recuperação acessível quando entry é cadastro e existe pendência,
   mesmo após receber user. Liberar rotas do app somente com identidade, perfil
   persistido confirmado e nenhuma operação composta pendente. Não simular isso
   apenas atrasando o onAuthStateChanged ou usando um timeout.
4. Definir API do contexto para iniciar/finalizar essa operação. Os pontos de ligação
   nas telas são imediatamente antes de cadastrarUsuario/recuperarPerfilIncompleto
   e depois do retorno, com tratamento de falha/desmontagem. Não há chamadas a uma
   API provisória inexistente nesta entrega.
5. Preservar no contexto apenas o rascunho não sensível necessário se houver remount
   por navegação: UID esperado, e-mail, nome e central. Nunca senha, token, User ou
   causa. No reload completo, retomar pela mesma conta autenticada e verificação
   real do perfil; não prometer recuperar rascunho que só estava em memória.
6. Quando for preciso autenticar novamente, permitir o caminho de login da mesma
   conta sem descartar silenciosamente a pendência ou permitir gravar em outro UID.
   A tela atual pede entrar novamente, mas o roteamento efetivo depende desse ajuste.
7. Depois da correção, substituir a reprodução do guard por testes de aceitação:
   conta recebida durante cadastro mantém a tela; parcial continua recuperável;
   snapshot sozinho não libera app; completo libera; UID diferente invalida respostas
   anteriores. Testar ainda Firestore confirmado/Auth pendente na recuperação.

Não fiz alterações em AuthContext, _layout, serviço, tipos de retorno do serviço ou
seus testes. A correção acima foi encaminhada neste documento e na entrega ao usuário;
nenhum agente paralelo ou serviço externo foi acionado para alterar esses arquivos.

## Validação local

```powershell
node --test tests/profile-front-end.test.cjs
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd export --platform web --output-dir dist
```

19 testes novos de tela/helper e 126 testes totais passaram. Tipos, lint sem cache
e build web também passaram. Build exportado localmente em dist, sem deploy.
Os mocks renderizam os componentes TypeScript reais com React; imports inesperados
são negados e SDK/configuração Firebase não são carregados. Não há ViaCEP real,
criação de conta, alteração de perfil ou gravação em dados reais.

react-test-renderer emite aviso de depreciação sem falhas. Não é homologação visual
em dispositivos, AuthContext integrado, Firebase real, regras, concorrência entre
aparelhos, reconexão ou persistência do rascunho após reload. Nenhum emulador foi
iniciado nesta etapa.

Telemetria v2 e SVG de Metas não foram incorporados. Sem commit, push, merge, deploy
ou alterações de dependências. Aguardar revisão e ajuste do Codex antes de declarar
o fluxo integrado concluído ou publicar.
