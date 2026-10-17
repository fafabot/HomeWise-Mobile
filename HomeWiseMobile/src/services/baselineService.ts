import {
  collection,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
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
 * Agrega a telemetria bruta em um resumo diario persistido no Firestore (Downsampling).
 * Garante que 1 ano inteiro de operacao ocupe apenas 365 pequenos documentos.
 */
export async function sincronizarConsumoDiario(leitura: Leitura): Promise<void> {
  if (!leitura || !leitura.dispositivo_id) return;

  const dataReferencia = leitura.criado_em ? new Date(leitura.criado_em) : new Date();
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
 */
export function observarHistoricoDiario(
  callback: (historico: ConsumoDiario[]) => void,
  dispositivoId: string,
  limiteDias = 31
) {
  if (!dispositivoId || !dispositivoId.trim()) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'consumo_diario'),
    where('dispositivo_id', '==', dispositivoId),
    orderBy('data', 'asc'),
    limit(limiteDias)
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
          data: d.data,
          consumo_agua_litros: Number(d.consumo_agua_litros || 0),
          energia_kwh: Number(d.energia_kwh || 0),
          pico_potencia_w: Number(d.pico_potencia_w || 0),
          pico_vazao_l_min: Number(d.pico_vazao_l_min || 0),
          media_tensao_v: Number(d.media_tensao_v || 127),
          leituras_computadas: Number(d.leituras_computadas || 1),
          atualizado_em: d.atualizado_em?.toDate ? d.atualizado_em.toDate() : new Date()
        });
      });
      callback(lista);
    },
    (err) => {
      console.warn('[Baseline] Erro ao observar historico diario:', err.message);
      callback([]);
    }
  );
}

/**
 * Calcula os indicadores comportamentais e a Linha de Base (Baseline).
 * Nos primeiros 30 dias: modo aprendizado.
 * Apos 30 dias: compara o consumo atual com a media aprendida.
 */
export function calcularStatusBaseline(
  historicoDiario: ConsumoDiario[],
  consumoHojeAgua: number,
  consumoHojeEnergia: number
): StatusBaseline {
  const META_DIAS = 30;
  const diasValidos = historicoDiario.filter((d) => d.consumo_agua_litros > 0 || d.energia_kwh > 0);
  const totalDias = Math.max(diasValidos.length, 1);

  // Calcula medias historicas
  const somaAgua = diasValidos.reduce((acc, cur) => acc + cur.consumo_agua_litros, 0);
  const somaEnergia = diasValidos.reduce((acc, cur) => acc + cur.energia_kwh, 0);

  // Valores padrao de referencia caso haja poucos dias (baseados em dados Procel/Sabesp)
  const mediaAgua = diasValidos.length > 0 ? somaAgua / totalDias : 140.0;
  const mediaEnergia = diasValidos.length > 0 ? somaEnergia / totalDias : 5.0;

  const diasContados = diasValidos.length;
  const calibrado = diasContados >= META_DIAS;
  const progresso = Math.min(Math.round((diasContados / META_DIAS) * 100), 100);

  // Comparacao percentual do consumo de hoje contra a media
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
