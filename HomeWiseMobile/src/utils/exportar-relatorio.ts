import { Platform, Share } from 'react-native';
import type { ConsumoDiario } from '@/services/baselineService';
import type { Leitura } from '@/services/leiturasService';

export type RecursoRelatorio = 'agua' | 'energia';

function obterDataFormatadaLocal(dataObj: Date): string {
  const ano = dataObj.getFullYear();
  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const dia = String(dataObj.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function consolidarRegistrosParaRelatorio(
  historicoDiario: ConsumoDiario[] = [],
  leituras: Leitura[] = []
): ConsumoDiario[] {
  const mapaPorDia = new Map<string, ConsumoDiario>();

  for (const item of historicoDiario) {
    if (!item?.data) continue;
    const existente = mapaPorDia.get(item.data);
    if (!existente) {
      mapaPorDia.set(item.data, { ...item });
    } else {
      existente.consumo_agua_litros = Math.max(existente.consumo_agua_litros, Number(item.consumo_agua_litros || 0));
      existente.energia_kwh = Math.max(existente.energia_kwh, Number(item.energia_kwh || 0));
      existente.pico_potencia_w = Math.max(existente.pico_potencia_w || 0, Number(item.pico_potencia_w || 0));
      existente.pico_vazao_l_min = Math.max(existente.pico_vazao_l_min || 0, Number(item.pico_vazao_l_min || 0));
    }
  }

  for (const leitura of leituras) {
    if (!leitura?.criado_em) continue;
    const dataObj = new Date(leitura.criado_em);
    if (!Number.isFinite(dataObj.getTime()) || dataObj.getTime() <= 0) continue;

    const dataStr = obterDataFormatadaLocal(dataObj);
    const agua = Math.max(Number(leitura.consumo_agua_litros || 0), 0);
    const energia = Math.max(Number(leitura.energia_kwh || 0), 0);
    const potencia = Math.max(Number(leitura.potencia_w || 0), 0);
    const vazao = Math.max(Number(leitura.vazao_l_min || 0), 0);
    const tensao = Number(leitura.tensao_v || 0);

    const existente = mapaPorDia.get(dataStr);
    if (!existente) {
      mapaPorDia.set(dataStr, {
        id: `${leitura.dispositivo_id || 'central'}_${dataStr}`,
        dispositivo_id: leitura.dispositivo_id || '',
        data: dataStr,
        consumo_agua_litros: agua,
        energia_kwh: energia,
        pico_potencia_w: potencia,
        pico_vazao_l_min: vazao,
        media_tensao_v: tensao > 0 ? tensao : 127,
        leituras_computadas: 1,
        atualizado_em: dataObj
      });
    } else {
      existente.consumo_agua_litros = Math.max(existente.consumo_agua_litros, agua);
      existente.energia_kwh = Math.max(existente.energia_kwh, energia);
      existente.pico_potencia_w = Math.max(existente.pico_potencia_w || 0, potencia);
      existente.pico_vazao_l_min = Math.max(existente.pico_vazao_l_min || 0, vazao);
      if (tensao > 0) {
        existente.media_tensao_v = tensao;
      }
      existente.leituras_computadas = (existente.leituras_computadas || 1) + 1;
    }
  }

  return Array.from(mapaPorDia.values()).sort((a, b) => a.data.localeCompare(b.data));
}

function escaparCelulaCsv(valor: string | number): string {
  const texto = String(valor ?? '').replace(/"/g, '""');
  return `"${texto}"`;
}

/**
 * Gera o conteúdo CSV (separado por ponto e vírgula, padrão PT-BR / Excel, com BOM UTF-8)
 * contendo os registros históricos consolidados do usuário autorizado (RF24).
 */
export function gerarCsvHistoricoConsumo(
  recurso: RecursoRelatorio,
  dispositivoId: string,
  historicoDiario: ConsumoDiario[] = [],
  leituras: Leitura[] = []
): string {
  const consolidados = consolidarRegistrosParaRelatorio(historicoDiario, leituras);
  const cabecalho =
    recurso === 'agua'
      ? ['Data', 'Dispositivo', 'Consumo de Agua (L)', 'Pico de Vazao (L/min)', 'Leituras Computadas']
      : ['Data', 'Dispositivo', 'Consumo de Energia (kWh)', 'Pico de Potencia (W)', 'Tensao Media (V)', 'Leituras Computadas'];

  const linhas = [...consolidados]
    .reverse()
    .map((dia) => {
      const central = dia.dispositivo_id || dispositivoId || 'central_homewise';
      if (recurso === 'agua') {
        return [
          dia.data,
          central,
          Number(dia.consumo_agua_litros || 0).toFixed(1).replace('.', ','),
          Number(dia.pico_vazao_l_min || 0).toFixed(2).replace('.', ','),
          dia.leituras_computadas || 1
        ];
      }
      return [
        dia.data,
        central,
        Number(dia.energia_kwh || 0).toFixed(2).replace('.', ','),
        Number(dia.pico_potencia_w || 0).toFixed(0),
        Number(dia.media_tensao_v || 127).toFixed(1).replace('.', ','),
        dia.leituras_computadas || 1
      ];
    });

  const todasLinhas = [cabecalho, ...linhas];
  return (
    '\ufeff' +
    todasLinhas
      .map((linha) => linha.map(escaparCelulaCsv).join(';'))
      .join('\n')
  );
}

/**
 * Exporta o relatório histórico em formato CSV no navegador (download direto)
 * ou abre o menu nativo de compartilhamento no Android/iOS (RF24).
 */
export async function exportarRelatorioConsumo(
  recurso: RecursoRelatorio,
  dispositivoId: string,
  historicoDiario: ConsumoDiario[] = [],
  leituras: Leitura[] = []
): Promise<boolean> {
  const csv = gerarCsvHistoricoConsumo(recurso, dispositivoId, historicoDiario, leituras);
  const nomeArquivo = `homewise-relatorio-${recurso}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined'
  ) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  if (Share && typeof Share.share === 'function') {
    await Share.share({
      title: `Relatório HomeWise (${recurso === 'agua' ? 'Água' : 'Energia'})`,
      message: csv
    });
    return true;
  }

  return false;
}
