import {
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Leitura } from './leiturasService';

export interface ConsumoDiario {
  id: string; // Ex: central_homewise_01_2026-10-16
  dispositivo_id: string;
  data: string; // Formato YYYY-MM-DD
  consumo_agua_litros: number;
  energia_kwh: number;
  pico_potencia_w: number;
  pico_vazao_l_min: number;
  media_tensao_v: number;
  leituras_computadas: number;
  atualizado_em?: Date;
}

export interface StatusBaseline {
  fase: 'aprendizado' | 'calibrado';
  diasRegistrados: number;
  metaDias: number;
  progressoPorcentagem: number;
  mediaAguaLitrosDia: number;
  mediaEnergiaKwhDia: number;
  comparativoAguaPercent: number; // % em relacao a baseline (+15% ou -10%)
  comparativoEnergiaPercent: number;
  statusEficiencia: 'otimo' | 'normal' | 'alerta';
  mensagem: string;
  dica: string;
}

function obterDataFormatada(dataObj: Date = new Date()): string {
  const ano = dataObj.getFullYear();
  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const dia = String(dataObj.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Unifica os documentos de `consumo_diario` com as leituras brutas de `leituras`,
 * garantindo que qualquer dia com medicao real do ESP8266 seja contabilizado mesmo
 * que o app nao estivesse aberto naquele dia para gravar o resumo diario.
 */
export function consolidarHistoricoDiario(
  historicoDiario: ConsumoDiario[],
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
      existente.pico_potencia_w = Math.max(existente.pico_potencia_w, Number(item.pico_potencia_w || 0));
      existente.pico_vazao_l_min = Math.max(existente.pico_vazao_l_min, Number(item.pico_vazao_l_min || 0));
    }
  }

  for (const leitura of leituras) {
    if (!leitura?.criado_em) continue;
    const dataObj = new Date(leitura.criado_em);
    if (!Number.isFinite(dataObj.getTime()) || dataObj.getTime() <= 0) continue;

    const dataStr = obterDataFormatada(dataObj);
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
      existente.pico_potencia_w = Math.max(existente.pico_potencia_w, potencia);
      existente.pico_vazao_l_min = Math.max(existente.pico_vazao_l_min, vazao);
      if (tensao > 0) {
        existente.media_tensao_v = tensao;
      }
      existente.leituras_computadas += 1;
    }
  }

  return Array.from(mapaPorDia.values()).sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Agrega a telemetria bruta em um resumo diario persistido no Firestore (Downsampling).
 * Garante que 1 ano inteiro de operacao ocupe apenas 365 pequenos documentos.
 */
export async function sincronizarConsumoDiario(leitura: Leitura): Promise<void> {
  if (!leitura || !leitura.dispositivo_id || !leitura.criado_em) return;
  const dataReferencia = new Date(leitura.criado_em);
  if (!Number.isFinite(dataReferencia.getTime()) || dataReferencia.getTime() <= 0) return;

  const dataStr = obterDataFormatada(dataReferencia);
  const docId = `${leitura.dispositivo_id}_${dataStr}`;
  const docRef = doc(db, 'consumo_diario', docId);

  try {
    // Usamos merge com setDoc para atualizar o acumulado do dia sem apagar picos anteriores
    await setDoc(
      docRef,
      {
        dispositivo_id: leitura.dispositivo_id,
        data: dataStr,
        consumo_agua_litros: Number(leitura.consumo_agua_litros || 0),
        energia_kwh: Number(leitura.energia_kwh || 0),
        media_tensao_v: Number(leitura.tensao_v || 127),
        atualizado_em: new Date()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Baseline] Erro ao sincronizar consumo diario:', error);
  }
}

/**
 * Escuta os registros diarios agregados para alimentar graficos e linha de base.
 * Filtra apenas por dispositivo_id (indice simples nativo do Firestore) e ordena por data em memoria.
 */
export function observarHistoricoDiario(
  callback: (historico: ConsumoDiario[]) => void,
  dispositivoId: string,
  limiteDias = 366
) {
  if (!dispositivoId || !dispositivoId.trim()) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'consumo_diario'),
    where('dispositivo_id', '==', dispositivoId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const lista: ConsumoDiario[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        lista.push({
          id: docSnap.id,
          dispositivo_id: d.dispositivo_id,
          data: d.data || '',
          consumo_agua_litros: Number(d.consumo_agua_litros || 0),
          energia_kwh: Number(d.energia_kwh || 0),
          pico_potencia_w: Number(d.pico_potencia_w || 0),
          pico_vazao_l_min: Number(d.pico_vazao_l_min || 0),
          media_tensao_v: Number(d.media_tensao_v || 127),
          leituras_computadas: Number(d.leituras_computadas || 1),
          atualizado_em: d.atualizado_em?.toDate ? d.atualizado_em.toDate() : new Date()
        });
      });
      lista.sort((a, b) => a.data.localeCompare(b.data));
      const cortada = limiteDias > 0 && lista.length > limiteDias
        ? lista.slice(lista.length - limiteDias)
        : lista;
      callback(cortada);
    },
    (err) => {
      console.warn('[Baseline] Erro ao observar historico diario:', err.message);
      callback([]);
    }
  );
}

/**
 * Calcula os indicadores comportamentais e a Linha de Base (Baseline) exclusivamente
 * a partir dos dias reais medidos pela central (unindo `consumo_diario` e `leituras`).
 */
export function calcularStatusBaseline(
  historicoDiario: ConsumoDiario[],
  consumoHojeAgua: number,
  consumoHojeEnergia: number,
  leituras: Leitura[] = []
): StatusBaseline {
  const META_DIAS = 30;
  const consolidados = consolidarHistoricoDiario(historicoDiario, leituras);
  const diasValidos = consolidados.filter((d) => d.consumo_agua_litros > 0 || d.energia_kwh > 0);

  // Calcula medias reais exclusivamente sobre os dias em que houve medicao
  const somaAgua = diasValidos.reduce((acc, cur) => acc + cur.consumo_agua_litros, 0);
  const somaEnergia = diasValidos.reduce((acc, cur) => acc + cur.energia_kwh, 0);

  const mediaAgua = diasValidos.length > 0 ? somaAgua / diasValidos.length : 0;
  const mediaEnergia = diasValidos.length > 0 ? somaEnergia / diasValidos.length : 0;

  const diasContados = diasValidos.length;
  const calibrado = diasContados >= META_DIAS;
  const progresso = Math.min(Math.round((diasContados / META_DIAS) * 100), 100);

  // Comparacao percentual do consumo de hoje contra a media real aprendida
  const diffAguaPercent = mediaAgua > 0 ? Math.round(((consumoHojeAgua - mediaAgua) / mediaAgua) * 100) : 0;
  const diffEnergiaPercent = mediaEnergia > 0 ? Math.round(((consumoHojeEnergia - mediaEnergia) / mediaEnergia) * 100) : 0;

  let statusEficiencia: 'otimo' | 'normal' | 'alerta' = 'normal';
  let mensagem = '';
  let dica = '';

  if (!calibrado) {
    statusEficiencia = 'normal';
    mensagem = `Fase de Aprendizado Ativa (${diasContados}/${META_DIAS} dias)`;
    dica = 'O sistema está conhecendo os hábitos de consumo da sua casa para personalizar os alertas.';
  } else {
    // Modo calibrado
    if (diffAguaPercent > 20 || diffEnergiaPercent > 20) {
      statusEficiencia = 'alerta';
      mensagem = 'Consumo acima da Linha de Base habitual';
      dica = 'Identificamos um consumo superior à sua média aprendida. Verifique aparelhos ligados ou torneiras.';
    } else if (diffAguaPercent < -10 && diffEnergiaPercent < -10) {
      statusEficiencia = 'otimo';
      mensagem = 'Parabéns! Consumo abaixo da média habitual';
      dica = 'Sua economia hoje está gerando um impacto positivo na previsão da fatura.';
    } else {
      statusEficiencia = 'normal';
      mensagem = 'Consumo dentro da Linha de Base esperada';
      dica = 'Seus hábitos de hoje estão perfeitamente alinhados com o padrão calibrado no primeiro mês.';
    }
  }

  return {
    fase: calibrado ? 'calibrado' : 'aprendizado',
    diasRegistrados: diasContados,
    metaDias: META_DIAS,
    progressoPorcentagem: progresso,
    mediaAguaLitrosDia: Number(mediaAgua.toFixed(1)),
    mediaEnergiaKwhDia: Number(mediaEnergia.toFixed(2)),
    comparativoAguaPercent: diffAguaPercent,
    comparativoEnergiaPercent: diffEnergiaPercent,
    statusEficiencia,
    mensagem,
    dica
  };
}
