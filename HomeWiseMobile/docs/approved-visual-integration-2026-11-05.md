# Incorporação do visual aprovado — 05/11/2026

## Aprovação e ordem de integração

A aprovação do usuário abrange o visual e a navegação do worktree
`HomeWise-Mobile-visual`, na branch `experiment/visual-inicio`. O experimento foi
preservado em sua própria pasta e registrado no commit
`a3c9aaf4a4c103ef5b185befe1d9303fe3820d3e`.

O PR #1, base funcional do experimento, foi integrado primeiro por merge no GitHub,
preservando os commits e a autoria existentes. Seu merge resultou em
`9b60ee6c77502ff676389977a82ecb1b9c7ccf95`.

A branch `integration/2026-11-05-approved-visual` parte dessa main e incorpora a
branch experimental por merge, sem copiar uma pasta sobre a outra ou reescrever
o histórico. Não houve conflito textual ou decisão funcional que exigisse descartar
uma das versões. O código-fonte integrado mantém o conteúdo do experimento aprovado.

## Trabalho preservado

- Componentes compartilhados de tema, cabeçalhos, botões, seletores, gráficos e
  cartões; apresentação responsiva e tratamento de movimento reduzido.
- Visual e navegação de entrada/cadastro, painel, consumo, alertas, metas, perfil,
  recuperação/alteração de senha, edição do perfil, assinaturas e leitor QR.
- Correções de navegação do perfil, confirmação de cancelamento e mensagens de
  simulação do checkout, com testes locais de regressão.
- Serviços e contratos de leituras/baseline, filtros de central, erros separados de
  vazio, cancelamento e testes anteriores. Nenhum desses serviços foi reimplementado
  pelo experimento.
- Estados independentes por fonte, retry explícito, dados desatualizados, acesso por
  plano e trabalho publicado dos colegas já incorporado pelo PR #1.

## Validação e limites

Verificações locais: TypeScript (`tsc --noEmit --incremental false`), lint
(`npm run lint -- --no-cache`), todos os testes (`npm test`) e exportação web
(`expo export --platform web --output-dir dist`). Os testes de interface usam Auth,
serviços e componentes nativos simulados; não gravam dados reais.

O checkout continua identificado na interface como **simulação acadêmica**, sem
cobrança real. A aprovação visual não constitui homologação de Firebase, pagamentos
ou câmera. Permanecem pendentes:

- Firebase real: regras, índices, isolamento, permissões, concorrência e comportamento
  offline em ambiente de testes autorizado.
- Pagamentos: integração real com adquirente, verificação de transação e autorização
  do plano no servidor. A ativação demonstrativa não comprova pagamento.
- Câmera e execução nativa: permissões, leitura de QR, lanterna e restauração de sessão
  em Android/iOS.
- Conferência da versão principal local pelo usuário após o merge e verificações em
  diferentes aparelhos e tamanhos de tela.

Não foram alteradas regras de produção, não houve deploy nem operações em dados reais.
Builds, dependências instaladas e backups não são publicados nos commits.

## Recuperação

Antes de registrar o experimento, uma cópia permanente fora do repositório foi criada
e verificada, com o checkout (incluindo arquivos novos) e um Git bundle do histórico.
As instruções estão no `RECOVERY.txt` dessa cópia. A pasta experimental e os backups
anteriores permanecem preservados. `node_modules` e builds gerados são reinstaláveis
e não fazem parte do arquivo de código do backup.
