import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  type FirestoreError
} from "firebase/firestore";
import { db } from "./firebase";
import { sincronizarConsumoDiario } from "./baselineService";

export interface Leitura {
  id?: string;
  dispositivo_id: string;
  consumo_agua_litros: number;
  vazao_l_min: number;
  potencia_w: number;
  energia_kwh: number;
  tensao_v: number;
  criado_em?: Date;
}

/**
 * O ESP8266 envia telemetria a cada 10s.
 * Se não houver leitura nos últimos 35s, a central é considerada desligada/offline.
 */
export const TEMPO_LIMITE_ONLINE_MS = 35_000;

export function centralEstaOnline(leitura: Leitura | null, agoraMs: number = Date.now()): boolean {
  if (!leitura?.criado_em) return false;
  const timestampLeitura = new Date(leitura.criado_em).getTime();
  if (!Number.isFinite(timestampLeitura) || timestampLeitura <= 0) return false;
  const diferencaMs = agoraMs - timestampLeitura;
  // Tolera até 60s de leve adiantamento de relógio local e até 35s desde o último pacote
  return diferencaMs >= -60_000 && diferencaMs <= TEMPO_LIMITE_ONLINE_MS;
}

export function leituraEhDeHoje(leitura: Leitura | null, agora: Date = new Date()): boolean {
  if (!leitura?.criado_em) return false;
  const data = new Date(leitura.criado_em);
  return (
    data.getFullYear() === agora.getFullYear() &&
    data.getMonth() === agora.getMonth() &&
    data.getDate() === agora.getDate()
  );
}

function converterLeitura(doc: QueryDocumentSnapshot<DocumentData>): Leitura {
  const data = doc.data();
  return {
    id: doc.id,
    dispositivo_id: data.dispositivo_id || '',
    consumo_agua_litros: Number(data.consumo_agua_litros || 0),
    vazao_l_min: Number(data.vazao_l_min || 0),
    potencia_w: Number(data.potencia_w || 0),
    energia_kwh: Number(data.energia_kwh || 0),
    tensao_v: Number(data.tensao_v || 0),
    criado_em: data.criado_em?.toDate
      ? data.criado_em.toDate()
      : (data.criado_em ? new Date(data.criado_em) : new Date(0))
  };
}

/**
 * Escuta a última leitura em tempo real.
 * Se nenhuma central estiver vinculada, retorna null imediatamente sem expor dados de terceiros.
 * Erros terminais são enviados apenas a onError, nunca como resultado vazio.
 * O retorno encerra o listener e descarta eventos posteriores ao cancelamento.
 */
export function observarUltimaLeitura(
  callback: (leitura: Leitura | null) => void,
  dispositivoId = '',
  onError?: (error: FirestoreError) => void
) {
  if (!dispositivoId || !dispositivoId.trim()) {
    callback(null);
    return () => {};
  }

  let cancelado = false;

  // Consulta sempre filtrada (requer índice composto dispositivo_id ASC + criado_em DESC).
  const qPrimaria = query(
    collection(db, "leituras"),
    where("dispositivo_id", "==", dispositivoId),
    orderBy("criado_em", "desc"),
    limit(1)
  );

  const unsubPrimaria = onSnapshot(
    qPrimaria,
    (snapshot) => {
      if (cancelado) return;
      if (!snapshot.empty) {
        const item = converterLeitura(snapshot.docs[0]);
        callback(item);
        void sincronizarConsumoDiario(item);
      } else {
        callback(null);
      }
    },
    (error) => {
      if (cancelado) return;
      cancelado = true;
      console.warn("[Firestore] Erro ao observar última leitura:", error.code, error.message);
      onError?.(error);
    }
  );

  return () => {
    cancelado = true;
    unsubPrimaria();
  };
}

/**
 * Escuta o histórico recente de leituras para gráficos e análises.
 * Snapshot vazio gera []; erro terminal gera apenas onError(error).
 * Não há nova consulta nem fallback em caso de erro. O retorno cancela a escuta.
 */
export function observarHistorico(
  callback: (leituras: Leitura[]) => void,
  limiteRegistros: number | null = 30,
  dispositivoId = '',
  onError?: (error: FirestoreError) => void
) {
  if (!dispositivoId || !dispositivoId.trim()) {
    callback([]);
    return () => {};
  }

  let cancelado = false;

  // Não ampliar esta consulta em caso de erro de índice ou autorização.
  const qPrimaria = query(
    collection(db, "leituras"),
    where("dispositivo_id", "==", dispositivoId),
    orderBy("criado_em", "desc"),
    ...(limiteRegistros === null ? [] : [limit(limiteRegistros)])
  );

  const unsubPrimaria = onSnapshot(
    qPrimaria,
    (snapshot) => {
      if (cancelado) return;
      const lista = snapshot.docs.map(converterLeitura);
      lista.sort((a, b) => (a.criado_em?.getTime() ?? 0) - (b.criado_em?.getTime() ?? 0));
      callback(lista);
    },
    (error) => {
      if (cancelado) return;
      cancelado = true;
      console.warn("[Firestore] Erro ao observar histórico:", error.code, error.message);
      onError?.(error);
    }
  );

  return () => {
    cancelado = true;
    unsubPrimaria();
  };
}
