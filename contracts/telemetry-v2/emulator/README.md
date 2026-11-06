# Prova local de autorização — somente demo-homewise

Não fazer deploy destas regras. Nenhum arquivo daqui é usado pelo app ou firmware.
Não existem projeto real, login de operador, recursos pagos ou credenciais reais.

## Pré-requisitos e execução reproduzível — PowerShell

Node >=24.12 e Java compatível com o emulador (Java 21+; execução validada com Java
26.0.2 e Node 24.15.0). Dependências fixadas e package-lock.json próprios desta pasta.

Na raiz do worktree isolado:

```powershell
node --test contracts/telemetry-v2/contract.test.cjs
Set-Location contracts/telemetry-v2/emulator
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run test:guards
npm.cmd test
```

O primeiro bootstrap baixa pacotes npm e, se não estiver em cache, o binário oficial
do emulador. Esses downloads de ferramentas exigem internet; operações de teste do
Firebase usam exclusivamente os endpoints abaixo. Não habilitar faturamento ou login.
Depois do bootstrap/cache, a prova não precisa de conexão com um projeto Firebase real.

npm test executa run-emulators.cjs, que inicia somente Firestore, roda a suíte e
encerra os processos próprios. Não há Functions, Auth emulator ou app em execução.
As identidades são simuladas pela biblioteca oficial rules-unit-testing; a prova
testa autorização em Security Rules, não emissão/autenticidade de tokens de produção.

| Uso | Endpoint fixo |
|---|---|
| Firestore default/demo-homewise | 127.0.0.1:18080 |
| Hub | 127.0.0.1:14400 |
| Logs internos | 127.0.0.1:14401 |
| Websocket do emulador | 127.0.0.1:19150 |

## Falha fechada

- Projeto literal demo-homewise, sem opção de projeto/host/comando no runner.
- Somente loopback IPv4, sem resolução DNS ou redirects nas sondagens.
- Runner recusa portas ocupadas para não reutilizar instância de colega.
- Processo filho recebe projeto demo fixo e remove variáveis de credenciais/hosts
  herdadas. O teste direto recusa credenciais e projetos/hosts diferentes.
- Antes de importar SDK Firebase, verifica configuração, Hub, Firestore e compilação
  das regras; indisponibilidade, timeout ou erro interrompe, sem fallback.
- O SDK recebe explicitamente host, porta e projectId demo. Nenhum config do app é lido.

Teste direto, sem emuladores disponíveis, **deve falhar com código diferente de zero**:

```powershell
npm.cmd run test:attached
```

Esse comando não inicia emuladores, não escolhe projeto real e não faz auto-fallback.
Com variáveis ausentes ele falha antes de inicializar o SDK; com endpoints corretos
mas processos indisponíveis, falha na sondagem local. Testes de guardas cobrem ambos
os contratos de falha, hosts/projetos errados e credenciais herdadas.

## O que os testes demonstram

1. Central A cria evento próprio e confirma por ID; tentativa em B ou payload B falha.
2. Morador A lê A, mas não lê/lista telemetria nem resumo de B.
3. Anônimo não lê nem grava dados/perfis.
4. Nome e seleção do perfil podem mudar; seleção de B não cria membership. Plano,
   status de assinatura, UID e role não podem ser promovidos no perfil.
5. Após criação aceita e revogação sintética local, o mesmo UID não cria outro evento.
6. Evento aceito não pode ser atualizado ou substituído pelo produtor. Reenvio é
   confirmação por leitura, não nova escrita no mesmo documento.

Também há negativas para escrita em cadastro/membership/resumo e timestamp escolhido
pelo cliente, e positivas para serverTimestamp e métrica inválida com null.
Asserções negativas exigem permission-denied; testes positivos evitam aprovação de
uma configuração que apenas nega tudo. Logs de PERMISSION_DENIED são esperados.

## Dados e limites

Usa somente fixtures sintéticas e sufixos únicos por execução. Harness semeia cadastro,
membership e perfil por bypass local de regras. Não chama clearFirestore, DELETE,
TTL, export/import de produção ou exclusão de documentos. Estado de teste fica na
memória do emulador e termina com seu processo; isso não é política de retenção.

Não valida IAM, regras implantadas, índices compostos, App Check, autenticação real,
pareamento, transferência, TLS, hardware, precisão física, custos, consolidação em
trigger ou concorrência de produção. As regras são recorte local, não revisão final
de segurança. Limites físicos e prazos de qualidade permanecem provisórios.

Fontes: [testes de regras](https://firebase.google.com/docs/rules/unit-tests),
[projetos demo e limitações](https://firebase.google.com/docs/emulator-suite/connect_firestore),
[execução da suíte](https://firebase.google.com/docs/emulator-suite/install_and_configure).
