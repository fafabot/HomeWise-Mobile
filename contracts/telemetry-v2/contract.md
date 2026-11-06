# Contrato v2 — proposta normativa para revisão

Os termos “deve” descrevem o comportamento futuro pretendido. Nada nesta pasta muda
o sistema atual. D1–D8 foram aprovadas para contrato e testes isolados, com ressalvas
em product-decisions.md; isso não homologa produção.

## Transporte, identidade e caminhos

Manter ESP8266 → Firestore REST. Proposta de caminho:
`centrais/{device_id}/telemetria_v2/{boot_id}__{seq}`. IDs aceitam somente
`[A-Za-z0-9_-]`, até 64 caracteres, e não podem conter `__`; sem barras.
`seq` é representada em decimal canônico no ID. A identidade autenticada deve estar
vinculada ao mesmo `device_id` no registro administrativo. Campos do payload não
concedem identidade. A chave pública Firebase não é autenticação.

Criar evento com precondição de inexistência; não atualizar nem excluir. Replay com
mesmo ID e conteúdo é entrega repetida, não novo evento. Em conflito, a central pode
consultar somente esse documento próprio para comparar o conteúdo canônico; conteúdo
diferente é conflito, exige diagnóstico, e não autoriza sobrescrita. A ordem das chaves
JSON não faz parte da identidade. O horário de recebimento não faz parte do conteúdo
comparado. Um primeiro evento malicioso já aceito não pode ser corrigido pela central;
o backend o coloca em quarentena e registra a decisão administrativa.

## Envelope

| Campo | Tipo/unidade | Nulabilidade e regra |
|---|---|---|
| `schema_version` | inteiro, valor `2` | obrigatório |
| `device_id` | identificador | obrigatório; igual ao caminho e ao registro autenticado |
| `firmware_version` | string, 1–64 caracteres | obrigatório; identificar build reproduzível |
| `boot_id` | identificador único por inicialização | obrigatório; nova inicialização nunca reutiliza ID |
| `seq` | inteiro seguro, 0…2^53−1 | obrigatório; crescente por boot, alocado na captura, não na retentativa |
| `uptime_ms` | inteiro seguro, ms | obrigatório; monotônico por boot, estender rollover de millis() |
| `measured_at` | timestamp UTC ou `null` | obrigatório; ISO UTC `Z` com precisão de ms nas fixtures; Timestamp no Firestore |
| `clock_quality` | `synced`, `estimated`, `unsynced` | obrigatório; unsynced exige measured_at null; demais exigem horário |
| `water_epoch` | identificador | obrigatório; muda quando o contador de pulsos perde continuidade |
| `water_pulses_total` | inteiro seguro, pulsos | `null` se qualidade não válida; nunca negativo |
| `calibration_id` | identificador | obrigatório; revisão imutável administrada de pulsos/L |
| `energy_epoch` | identificador | obrigatório; identifica continuidade do contador do medidor |
| `energy_total_wh` | número finito, Wh | `null` se qualidade não válida; resolução limitada à do PZEM |
| `flow_l_min` | número finito, L/min | `null` se qualidade não válida; não negativo |
| `power_w` | número finito, W | `null` se qualidade não válida; não negativo |
| `voltage_v` | número finito, V | `null` se qualidade não válida; não negativo |
| `quality` | mapa das cinco medições | obrigatório; um estado por campo numérico acima |

`quality` usa exatamente `water_pulses_total`, `energy_total_wh`, `flow_l_min`,
`power_w`, `voltage_v`. Estados: `valid`, `invalid`, `missing`, `stale`.
Somente `valid` permite número, inclusive zero; os demais exigem `null`.
Este formato não transmite o último valor válido como se fosse atual. O servidor
mantém separadamente esse valor e seu instante, quando houver. `invalid` é erro
detectado; `missing` é amostra indisponível; `stale` é prazo de atualização expirado.
O perfil de sensor e a futura política de qualidade definirão causas e limites (D3).
Ausência de evento inteiro é ausência de leitura, não um evento com zeros.

Campos desconhecidos são rejeitados nesta revisão. Não transmitir NaN, Infinity,
tokens, senhas ou valores numéricos como strings. Precisão extra no formato não
aumenta a precisão física. O envelope usa teto numérico técnico de 2^53−1 também
para medições fracionárias; isso não é um limite físico homologado. Limites físicos por sensor serão parâmetros administrados
e precisarão de homologação; as fixtures não os inventam.

O servidor acrescenta `received_at` de fonte confiável (horário de commit/criação ou
transformação de servidor validada por regras), `processing_version`, estado de
validação e revisão. A central não escolhe `received_at`. Na prova local, o adaptador
SDK acrescenta serverTimestamp ao envelope armazenado e as regras exigem request.time.
As fixtures de payload puro continuam sem received_at; o mecanismo REST do firmware
não foi implementado/homologado nesta etapa.

## Contadores, tempo e qualidade

- Água: usar pulsos brutos e calibração imutável, sem reset à meia-noite. Alteração
  de calibração cria uma fronteira: não converter todo o passado com o fator novo.
- Energia: usar total nativo do medidor convertido de kWh para Wh, sem subtrair a
  referência adquirida após boot. Boot do ESP não obriga nova época do PZEM.
- Para água, perda de RAM sem recuperação confiável implica nova época. Persistência
  periódica não permite alegar recuperação dos pulsos perdidos desde o checkpoint.
- Troca/reset/overflow do medidor ou contador: nova época e registro da causa.
  Queda dentro da mesma época é inconsistência, não consumo negativo nem reset inferido.
- `seq` detecta lacunas por boot; `uptime_ms` ordena capturas dentro do boot e ajuda
  a detectar saltos de relógio. Não usar a hora de chegada para distribuir consumo.
- IDs de boot e épocas nunca são reutilizados; rotacionar antes de esgotar o inteiro
  seguro, com fronteira explícita. Não reutilizar uma época antiga após troca/reset.
- Primeiro valor estabelece referência, salvo continuidade comprovada com amostra
  anterior da mesma época. Não inventar referência zero (D2).
- Uma amostra inválida não quebra necessariamente a continuidade do contador. Entre
  duas amostras válidas posteriores pode haver delta recuperável, marcado como lacuna.
  Instantâneos inválidos não são preenchidos com zero.
- Horários UTC são instantes; o dia civil vem do fuso IANA administrado da residência,
  por exemplo `America/Sao_Paulo`, nunca do fuso do celular. Alterar fuso tem vigência
  registrada e não reescreve dias antigos automaticamente (D4).
- Relógio apenas “maior que 2025” não comprova sincronização. O servidor verifica
  plausibilidade em relação à recepção, uptime e sequência. Estimated/unsynced ficam
  fora da alocação diária estrita até política/reconstrução aprovada (D1).
- Contador cumulativo pode recuperar volume de uma perda de mensagens, mas não o
  perfil temporal exato durante a lacuna. Intervalo cruzando dia sem amostra de
  fronteira é `unallocated`, com total preservado fora dos dias, sem rateio oculto (D1).
- Zero observado pode ser válido; zero pulsos não diagnostica desconexão do YF-S201.

## Duplicação, atraso e processamento pretendido

Fila persistente e limitada é requisito futuro; retentativas preservam ID/conteúdo;
backoff com jitter.
Confirmar persistência antes de retirar da fila. Perda/overflow da fila deve produzir
diagnóstico; tamanho, retenção e desgaste de flash dependem de D5. Não há garantia
de entrega nem de medição enquanto a central está sem alimentação.
Não excluir dados, aplicar TTL ou definir prazos de retenção nesta etapa (D5).

Servidor: registro bruto imutável, contribuição por intervalo, deduplicação por ID,
recomposição dos vizinhos quando evento atrasado chega e revisão transacional dos
resumos. Não somar novamente uma contribuição só porque o trigger repetiu. Eventos
com mesmo ID e conteúdos diferentes ficam em quarentena, sem contribuição automática.
Não ordenar arbitrariamente boots apenas pelo identificador. Continuidade entre boots
exige ordem temporal confiável e uma época do medidor comprovadamente contínua.

Resumos futuros: `device_id`, `local_date`, `timezone`, `schema_version`,
`aggregation_version`, `revision`, `water_l`, `energy_wh`, `coverage`, `status`,
`updated_at`. Status: `partial`, `complete`, `uncertain`; falta de resumo é ausência.
Consumo medido e estimado, se autorizado, ficam separados. Média de potência em W
não é energia em kWh; média temporal exige duração/cobertura e não amostras simples
com espaçamento irregular. Baseline usa os primeiros 30 dias completos e válidos,
incluindo zero medido, excluindo dia atual; referência congelada e recalibração
explícita. Critérios de qualidade/cobertura continuam provisórios até ensaio (D6).

## D1 — consulta de períodos sem estimativa silenciosa

Guardar cada contribuição com os dois extremos do intervalo. Se o intervalo inteiro
estiver contido no período consultado, somar seu delta exatamente uma vez, mesmo
quando atravessa dias internos ao período. Informar separadamente a parcela com
distribuição pendente. Essa parcela é parte do total, não um adicional.

Exemplo: 2 L entre 23:59:50 de 6/11 e 00:00:10 de 7/11 na residência. Nenhum dos
dois totais diários recebe os 2 L sem prova da divisão. O total de novembro inclui
os 2 L uma vez e informa “inclui 2 L sem distribuição diária”. A soma dos dias pode
ser menor que o mês; a diferença é explicada, nunca preenchida silenciosamente.

Se atravessar outubro/novembro, nenhum mês isolado recebe os 2 L; ambos indicam
fronteira pendente. O ano que contiver todo o intervalo pode incluí-los uma vez.
Não somar avisos de fronteira dos períodos vizinhos, pois descrevem o mesmo intervalo.
Limites do período são instantes UTC derivados do fuso administrado da residência.
Intervalo terminando exatamente no fim do período é integralmente contido; intervalo
começando nesse limite não pertence ao período anterior.

summarizePeriod é apenas oráculo de lote: total null quando não há contribuição
contida; distribution_pending_* é parcela já incluída; boundary_pending_* é parcela
não incluída cuja divisão na fronteira é desconhecida. Coverage continua partial.

## Escopo do oráculo local

reference.cjs recalcula lotes pequenos do zero, sem escrita e sem estado concorrente.
Ele exige relógio synced, usa ordenação por measured_at, valida monotonicidade de
seq/uptime por boot e soma diferenças dentro da mesma época e calibração. Saltos
de sequência e amostras inválidas intermediárias marcam cobertura parcial. Queda de
contador não é somada. Não estima intervalos entre dias. É uma especificação de
exemplos, não implementa reconciliação incremental, limites de atraso, rate limiting,
correção de relógio, quarentena durável ou transações. O backend deverá demonstrar
equivalência nos exemplos e cobrir essas funções adicionais.

No resultado do oráculo, `water_l` e `energy_wh` são somas de contribuições recuperadas;
zero na soma vazia não é evidência de medição zero. `daily` ausente significa nenhum
intervalo alocado; métrica null em um dia significa nenhuma contribuição daquela
métrica. Toda fixture tem coverage partial: nenhuma demonstra um dia completo.
`unallocated_*` guarda a parte recuperada que não pode ser atribuída a um único dia.
Esses campos diagnósticos não são um DTO pronto para o aplicativo. received_at nas
fixtures de entrega é metadata sintética: a política máxima de atraso ainda está em D1.

selectBaseline é referência local com flags sintéticas de dia complete/valid. Conta
datas únicas, exclui legado, dias incompletos, inválidos e o dia atual da residência.
Não homologa como determinar completude física. Em recalibração explícita, a seleção
é refeita sobre os dias fornecidos; o fluxo real de escolha/versionamento da janela
de recalibração ainda não foi implementado.

## Implementação local autorizada

core/consolidate.cjs implementa cálculo independente do oráculo, reutilizando somente
validação estrutural e conversão de data local. Contribuições são reconstruídas do
conjunto de eventos com IDs determinísticos; ingestão repetida não incrementa totais.
Documentação e limites da API estão em core/README.md. Nenhum adaptador Firebase,
trigger, gravação de resumo ou consumo pelo app foi implementado.

Refinamentos conservadores explícitos: ausência de contribuição resulta em null;
um intervalo encerrado exatamente à meia-noite fecha o dia anterior; quedas bloqueiam
a época afetada até uma nova época; cruzar boots exige evidência de continuidade
externa ao payload, confiável e específica para as duas amostras adjacentes. O teste
do medidor contínuo usa evidência sintética, sem presumir que um boot preserve água.
Nenhum desses controles comprova continuidade ou calibração física em produção.

## Legado e compatibilidade (preservado)

Documentos atuais sem schema_version, com `dispositivo_id`, `consumo_agua_litros`,
`energia_kwh`, `criado_em`, continuam classificados como `legacy_v1`. Ausência de
época/boot/qualidade/recepção não será preenchida com certezas inventadas.

Não somar máximos v1 como se fossem deltas v2, nem promover `criado_em` a horário
de recebimento. Documentos com versão desconhecida ficam `unsupported`, não legado.
Dados v2 malformados são rejeitados, não rebaixados silenciosamente para v1.

Coleções separadas e corte explícito por central, com instante e primeiro evento v2.
Mostrar legado identificado; não juntar ao total v2, conforme D7. Não
copiar automaticamente baseline nem regravar dados antigos. Reprocessamento futuro
exigirá aprovação, trilha de auditoria, versão e limites de precisão documentados.
