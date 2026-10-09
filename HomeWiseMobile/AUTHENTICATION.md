# Login e cadastro

O app usa Firebase Authentication do projeto `homewise-65bb1`. No console do Firebase, abra **Authentication → Sign-in method → Email/Password** e habilite o provedor de e-mail e senha.

Execute `npm install` e `npm start` nesta pasta para abrir o app. Ao abrir o app, as boas-vindas aparecem antes das outras telas. Sem sessão, os botões levam ao login e ao cadastro; com uma sessão salva, **Continuar** abre o painel. O cadastro pede e-mail, senha com pelo menos seis caracteres e confirmação. Uma conta criada entra automaticamente. Senhas são verificadas pelo Firebase, sem armazenamento manual no app.

As telas usam a logo original em `assets/images/logo homewise.png`. No login, **Esqueceu sua senha?** abre a recuperação por e-mail. O Firebase envia um link para sua página de redefinição de senha; o app mostra a confirmação do pedido. Não é necessário informar a senha antiga.

As telas internas exigem uma sessão. O perfil mostra o e-mail da conta e permite sair. A sessão é persistida pelo Firebase no navegador e com AsyncStorage no Android/iOS.

Para validar manualmente:

1. Cadastre uma conta de teste com um e-mail seu e senhas iguais.
2. Confira o e-mail no perfil e saia da conta.
3. Tente entrar com uma senha errada: deve aparecer uma mensagem de erro sem liberar as telas internas.
4. Entre com a senha correta e reinicie o app: a sessão deve permanecer ativa.
5. Após sair, tente acessar uma rota interna: o app deve mostrar o login.
6. Tente cadastrar novamente o mesmo e-mail e tente confirmar uma senha diferente: ambos devem exibir um erro.
7. No login, abra a recuperação de senha, informe o e-mail da conta e siga o link recebido para escolher uma nova senha. Volte ao app e entre com a nova senha.

A proteção de navegação não substitui as regras de segurança do Firestore. A autorização das leituras deve ser definida nas regras do projeto Firebase conforme o modelo de residências.
