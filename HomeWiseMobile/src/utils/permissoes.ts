import type { DadosUsuario, PerfilAcesso } from '@/services/authService';

export interface ParametroCalibracaoHardware {
  chave: string;
  titulo: string;
  valor: string;
  detalhe: string;
}

/**
 * Retorna o perfil de acesso do usuário (RF04).
 * Caso o campo `perfil_acesso` não esteja definido no documento do Firestore,
 * assume o perfil padrão de `'morador'`.
 */
export function obterPerfilAcesso(perfil?: Partial<DadosUsuario> | null): PerfilAcesso {
  const valor = perfil?.perfil_acesso;
  if (valor === 'admin' || valor === 'suporte') {
    return valor;
  }
  return 'morador';
}

/**
 * Verifica se o usuário possui permissão administrativa ou de suporte técnico (RF04).
 */
export function temPermissaoAdmin(perfil?: Partial<DadosUsuario> | null): boolean {
  const papel = obterPerfilAcesso(perfil);
  return papel === 'admin' || papel === 'suporte';
}

/**
 * Retorna o rótulo legível do perfil de acesso (RF04).
 */
export function rotuloPerfilAcesso(perfil?: Partial<DadosUsuario> | null): string {
  const papel = obterPerfilAcesso(perfil);
  if (papel === 'admin') return 'Administrador';
  if (papel === 'suporte') return 'Suporte Técnico';
  return 'Morador';
}

/**
 * Parâmetros técnicos de calibração e operação da Central HomeWise (ESP8266 WeMos D1 R1),
 * exibidos exclusivamente no Painel Administrativo / Diagnóstico Técnico (RF04).
 */
export function obterParametrosCalibracaoHardware(): ParametroCalibracaoHardware[] {
  return [
    {
      chave: 'microcontrolador',
      titulo: 'Microcontrolador da Central',
      valor: 'ESP8266 WeMos D1 R1',
      detalhe: 'Conectividade Wi-Fi IEEE 802.11 b/g/n (2,4 GHz)',
    },
    {
      chave: 'sensor_agua',
      titulo: 'Sensor de Vazão (YF-S201)',
      valor: '402,5 pulsos/L',
      detalhe: 'Interrupção externa no pino D4 (GPIO4) com cálculo a cada 1.000 ms',
    },
    {
      chave: 'sensor_energia',
      titulo: 'Medidor Elétrico (PZEM-004T v3.0)',
      valor: 'UART 9600 bps',
      detalhe: 'Comunicação serial via SoftwareSerial nos pinos D5 (RX) e D6 (TX)',
    },
    {
      chave: 'intervalo_envio',
      titulo: 'Janela de Transmissão',
      valor: '10 segundos',
      detalhe: 'Envio periódico para Cloud Firestore / API REST com validação de grandezas',
    },
    {
      chave: 'fila_offline',
      titulo: 'Recuperação de Conectividade (RF10)',
      valor: 'Buffer de 10 leituras',
      detalhe: 'Fila circular em RAM para retenção e reenvio automático após reconexão',
    },
  ];
}

