# Matriz proposta de permissões

Isto é especificação, não regras implantadas. Não foi verificado o estado de produção.
Negar por padrão. As regras da prova em emulator/firestore.rules são executadas
somente localmente; não representam nem substituem regras implantadas ou IAM.

| Ação | Central | Morador | Administrador |
|---|---|---|---|
| Criar evento v2 próprio válido | sim, ativa e UID vinculado | não | não pelo cliente comum |
| Criar evento em outra central | não | não | não pelo cliente comum |
| Ler evento próprio por ID para confirmar replay | sim | se membro da central | via serviço autorizado |
| Listar telemetria | não | somente central autorizada e consulta limitada | via serviço autorizado |
| Atualizar/excluir evento bruto | não | não | não no fluxo normal; exceção auditada fora deste contrato |
| Ler estado atual e resumos | não necessário; negar inicialmente | se membro | via serviço autorizado |
| Escrever resumos/contribuições | não | não | somente consolidador dedicado |
| Editar perfil pessoal permitido | não | somente próprio; campos explicitamente permitidos | via serviço autorizado |
| Conceder vínculo/role pelo perfil ou QR público | não | não | não como edição livre do perfil |
| Parear central | não | solicitar com prova de posse válida | serviço valida e cria vínculo |
| Gerir membros, revogar ou provisionar central | não | não diretamente | serviço administrativo dedicado e auditado |
| Alterar regras/índices/configuração | não | não | operador de infraestrutura autorizado; fora deste pacote |

## Fronteiras de confiança

Central autenticada: uid próprio; registro administrado liga uid ↔ device_id e ativo.
Se estiver revogada/inativa, negar inclusive com ID token ainda válido. Claims de
papel só são emitidas em ambiente confiável; nem central nem morador as escolhem.

Morador: membro ativo no registro administrado. `usuarios/{uid}.dispositivo_id`
serve apenas como seleção de interface; não autoriza acesso. O morador não pode
modificar vínculo, role, plano administrativo ou registro da central por mass assignment.
Histórico após transferência permanece pendente em D8; transferência não implementada.

Administrador não é uma flag editável no app. Serviços de provisionamento, pareamento
e consolidação usam identidades separadas, mínimo privilégio e auditoria. SDK Admin
usa IAM e não passa por Security Rules; não basta testar uma claim admin no emulador.
Credenciais administrativas nunca entram nas fixtures, firmware ou bundle do app.

Validação de criação: UID, device_id do caminho e do payload, central ativa, versão,
campos permitidos, tipos, qualidade, limites, document ID e timestamp de servidor.
Central não escreve `received_at` arbitrário nem estado de processamento. Validar
essas operações no REST real faz parte da futura etapa, não é demonstrado pelo
predicado local de permissões.

## Casos A/B obrigatórios

Fixtures sintéticas: `central_a` pertence ao UID `device-a`; `central_b` ao UID
`device-b`. Morador `resident-a` é membro somente de A. O teste local cobre a
política proposta; emulator/authorization.test.cjs prova as seis propriedades aprovadas
contra regras locais. Os testes emulados usam sufixos únicos por execução, sem limpar
documentos anteriores. Identidades são simuladas, não tokens obtidos via Auth real.

- A cria em A; A não cria em B mesmo trocando device_id no JSON.
- Usuário não autenticado ou morador não cria telemetria.
- A revogada não cria em A mesmo com token ainda presente.
- Morador A lê A; não lê B mesmo selecionando B no perfil.
- Central A só confirma evento de A por ID; não lista telemetria.
- Morador não escreve resumo nem concede membership.
- Operador cliente com claim de administrador não equivale ao serviço de backend.
- Serviço consolidador escreve resumo; serviço de provisionamento não ganha essa
  permissão por ser backend. Serviço administrativo pode revogar; consolidador não.

Para comparação futura com produção, obter cópia somente para leitura das regras publicadas e seu
release, índices implantados e estado, região/banco, Auth/App Check e IAM relevantes,
escritores existentes e requisitos de auditoria. Não presumir proteção ou abertura.

## Recorte executado no emulador

Cadastro e memberships são semeados somente pelo harness com regras desabilitadas
no endpoint local. Nenhum papel administrativo do cliente pode editar esses dados.
O mesmo mecanismo simula uma revogação local após uma criação aceita; a tentativa
seguinte com o mesmo UID é negada. Isso não é implementação de provisionamento,
transferência ou de serviço administrativo.

Perfil próprio permite somente nome e seleção de dispositivo. UID, plano, status de
assinatura e role não podem ser promovidos pelo cliente. Selecionar B continua sem
autorizar B. Testes positivos asseguram que o isolamento não decorre de negar tudo.
