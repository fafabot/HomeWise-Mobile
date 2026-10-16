# Dossier de Contexto e Continuidade - Projeto HomeWise (TCC SENAI Suzano 2026)

> **Instrução para a IA / Assistente:**
> Este documento contém todo o contexto arquitetural, elétrico, de firmware, backend e mobile do ecossistema **HomeWise**.
> Ao iniciar uma nova sessão em outro computador, leia este documento na íntegra para assumir o desenvolvimento sem necessidade de explicações prévias do usuário.

---

## 1. Visão Geral do Projeto

* **Projeto:** HomeWise — Ecossistema IoT de Monitoramento Residencial Inteligente de Água e Energia Elétrica.
* **Instituição:** SENAI Suzano — Curso Técnico em Desenvolvimento de Sistemas / Automação (2026).
* **Repositório / Estrutura:**
  * `HomeWise/`: Firmware em C++ para ESP8266 (NodeMCU V3) com PlatformIO.
  * `HomeWise-Mobile/`: Aplicativo mobile multiplataforma (React Native, Expo SDK 57, TypeScript, Firebase).
  * `Homewise_/`: Hotsite web institucional e e-commerce de planos/assinaturas.
  * `TCC_HomeWise_Documentacao_Aprimorada.md` / `.docx`: Monografia acadêmica completa padrão ABNT.

---

## 2. Hardware e Esquema Elétrico

### Microcontrolador
* **Modelo:** LOLIN NodeMCU V3 (ESP8266-12E), 80 MHz, 80 KB RAM, 4 MB Flash.
* **Firmware Framework:** Arduino sob PlatformIO (`nodemcuv2`).

### Sensor de Vazão de Água (YF-S201)
* **Princípio:** Efeito Hall com rotor de pás magnetizado.
* **Alimentação:** 5V (pino `VU` do NodeMCU).
* **Sinal de Pulso:** Pino `D5` (GPIO14) com interrupção externa (`FALLING`).
* **Divisor de Tensão de Proteção (5V -> 3,3V):**
  * Resistores: $R_1 = 10\text{ k}\Omega$ (entre pino de sinal do sensor e GPIO14) e $R_2 = 20\text{ k}\Omega$ (entre GPIO14 e GND).
  * $V_{out} = 5\text{V} \times \frac{20}{10 + 20} = 3,33\text{V}$ (seguro para o ESP8266).
* **Fator de Calibração Experimental:**
  * $K = 402,5 \text{ pulsos/L}$ (determinado empiricamente com proveta volumétrica graduada).

### Medidor de Grandezas Elétricas (Peacefair PZEM-004T v3.0)
* **Grandezas Medidas:** Tensão RMS ($V$), Corrente RMS ($A$), Potência Ativa ($W$), Energia Ativa Acumulada ($kWh$), Frequência ($Hz$) e Fator de Potência ($PF$).
* **Comunicação:** UART TTL via `EspSoftwareSerial`:
  * ESP8266 `D6` (GPIO12, RX) $\leftarrow$ PZEM `TX`
  * ESP8266 `D7` (GPIO13, TX) $\rightarrow$ PZEM `RX`
  * Baud Rate: 9600 bps, 8N1.
* **Regra Fundamental de Alimentação do PZEM:**
  * Os optoacopladores lógicos TTL operam em 5V DC (vindos do `VU` e `GND`).
  * **O chip interno de medição analógica só liga quando os bornes AC (127V/220V) estiverem conectados à rede elétrica.** Sem AC, a UART não responde.

### Display Local (OLED I2C 0.96" SSD1306)
* **Resolução:** 128x64 pixels.
* **Comunicação I2C:** Pino `D1` (GPIO5, SCL) e `D2` (GPIO4, SDA).
* **Endereço I2C:** `0x3C`.

---

## 3. Arquitetura de Nuvem e Ingestão Direta

O ecossistema adota ingestão direta **ESP8266 $\rightarrow$ Google Cloud Firestore** via HTTPS REST:

```
[ Sensor YF-S201 ]  \
                     --> [ ESP8266 NodeMCU V3 ] --(HTTPS BearSSL / TLS)--> [ Google Cloud Firestore ]
[ PZEM-004T v3.0 ]  /       (1 envio a cada 10s)                               |
                                                                               v
                                                                   [ App Mobile (Expo / React Native) ]
                                                                   (Listener onSnapshot em Tempo Real)
```

### Configurações de Conexão ([`HomeWise/include/config.h`](file:///d:/Windows/Documentos/senai/TCC/HomeWise/include/config.h))
* **Projeto Firebase:** `homewise-65bb1`
* **Coleção:** `leituras`
* **Dispositivo Padrão:** `central_homewise_01`
* **URL REST:**
  `https://firestore.googleapis.com/v1/projects/homewise-65bb1/databases/(default)/documents/leituras?key=FIREBASE_API_KEY`
* **Intervalo de Envio:** `10000 ms` (10 segundos).
  * 8.640 gravações/dia, dentro do plano gratuito Spark (limite de 20.000 gravações/dia).

### Otimizações Críticas no Firmware ([`HomeWise/src/comunicacao.cpp`](file:///d:/Windows/Documentos/senai/TCC/HomeWise/src/comunicacao.cpp))
* **SSL/TLS BearSSL:** `client->setBufferSizes(1024, 512)` economiza ~20 KB de memória RAM Heap.
* **NTP Time Sync:** `configTime(0, 0, "pool.ntp.org", "time.google.com")`.
* **Guarda Temporal:** Garante que o relógio ultrapasse o ano de 2025 (`time(nullptr) >= 1735689600`) antes de enviar leituras, garantindo data e hora reais em formato ISO 8601 no campo `criado_em` (`timestampValue`).

### Schema do Documento no Firestore
```json
{
  "dispositivo_id": "central_homewise_01",
  "consumo_agua_litros": 0.0,
  "vazao_l_min": 0.0,
  "potencia_w": 16.5,
  "energia_kwh": 0.002,
  "tensao_v": 123.1,
  "criado_em": "2026-10-16T07:47:00Z"
}
```

---

## 4. Frontend Mobile (HomeWise Mobile)

* **Localização:** `HomeWise-Mobile/HomeWiseMobile`
* **Associação e Isolamento de Centrais:** Cada morador tem seu `dispositivo_id` vinculado em `usuarios/{uid}`. Não há vinculação padrão forçada: se um usuário novo se cadastrar sem vincular uma central, o app exibe um banner de pareamento na home e bloqueia a leitura de dados de centrais alheias, garantindo total privacidade multitenant.
* **Leitor Nativo de QR Code (`expo-camera`):** Scanner de câmera integrado em tempo real (`/escanear-qrcode`) com moldura visual de mira e lanterna, permitindo escanear a etiqueta QR Code da central física e vinculá-la instantaneamente sem necessidade de digitação.

### Serviço de Leituras em Tempo Real ([`leiturasService.ts`](file:///d:/Windows/Documentos/senai/TCC/HomeWise-Mobile/HomeWiseMobile/src/services/leiturasService.ts))
* Implementa escuta reativa `onSnapshot` com ordenação cronológica decrescente (`orderBy("criado_em", "desc")`).
* **Mecanismo de Duplo Modo com Fallback Resiliente:**
  1. Consulta ótima indexada no servidor (`where("dispositivo_id", "==", ...) + orderBy("criado_em", "desc")`).
  2. Fallback automático transparente por ordenação temporal simples caso o índice composto do Firebase ainda não tenha sido gerado. Garante que o morador veja a medição do segundo exato sem nunca travar o app.
* **Link para ativação com 1 clique do índice composto no console do Firebase:**
  `https://console.firebase.google.com/v1/r/project/homewise-65bb1/firestore/indexes?create_composite=Ck9wcm9qZWN0cy9ob21ld2lzZS02NWJiMS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbGVpdHVyYXMvaW5kZXhlcy9fEAEaEgoOZGlzcG9zaXRpdm9faWQQARoNCgljcmlhZG9fZW0QAhoMCghfX25hbWVfXxAC`

---

## 5. Status Atual e Branches do Git

1. **Repositório Firmware (`HomeWise`):**
   * **Branch Ativa:** `feat/conexao-direta-firebase`
   * Compilação limpa no PlatformIO (RAM: 40.5%, Flash: 40.0%).
   * Suporte a comandos seriais para testes:
     * `'r'`: reseta contadores parciais de água e energia.
     * `'p'`: diagnóstico imediato da comunicação UART com o PZEM-004T.
2. **Repositório Mobile (`HomeWise-Mobile`):**
   * **Branch Ativa:** `main`
   * TypeScript validado com zero erros (`npx tsc --noEmit`).

---

## 6. Prompt para Colar no Início de uma Nova Conversa

Caso você abra uma nova conversa em qualquer computador do SENAI, basta copiar e colar a mensagem abaixo:

```text
Olá! Estou continuando o desenvolvimento do projeto HomeWise (TCC SENAI Suzano 2026).
Por favor, leia o arquivo "CONTEXTO_PROJETO_HOMEWISE.md" presente na raiz do repositório para carregar todo o contexto técnico de hardware (ESP8266, YF-S201, PZEM-004T), nuvem Firebase Firestore e aplicativo React Native Expo SDK 57.
Confirme que leu e aguarde minha próxima instrução.
```

