import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "./firebase";

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
      : (data.criado_em ? new Date(data.criado_em) : new Date())
  };
}

/**
 * Escuta a última leitura em tempo real.
 * Se nenhuma central estiver vinculada, retorna null imediatamente sem expor dados de terceiros.
 */
export function observarUltimaLeitura(
  callback: (leitura: Leitura | null) => void,
  dispositivoId = ''
) {
  if (!dispositivoId || !dispositivoId.trim()) {
    callback(null);
    return () => {};
  }

  let unsubFallback: (() => void) | null = null;
  let cancelado = false;

  // 1. Tenta query ótima no servidor (requer índice composto dispositivo_id ASC + criado_em DESC)
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
        callback(converterLeitura(snapshot.docs[0]));
      } else {
        callback(null);
      }
    },
    (error) => {
      if (cancelado) return;
      console.warn(
        "[Firestore] Query indexada requer índice composto no console. Ativando fallback cronológico automático...",
        error.message
      );

      // 2. Fallback resiliente: ordena diretamente por criado_em DESC (índice padrão simples do Firestore)
      const qFallback = query(
        collection(db, "leituras"),
        orderBy("criado_em", "desc"),
        limit(50)
      );

      unsubFallback = onSnapshot(
        qFallback,
        (snapshot) => {
          if (cancelado) return;
          const correspondentes = snapshot.docs
            .map(converterLeitura)
            .filter((item) => item.dispositivo_id === dispositivoId);

          if (correspondentes.length > 0) {
            callback(correspondentes[0]);
          } else {
            callback(null);
          }
        },
        (errFallback) => {
          console.warn("[Firestore] Erro no fallback de leitura:", errFallback.message);
        }
      );
    }
  );

  return () => {
    cancelado = true;
    unsubPrimaria();
    if (unsubFallback) {
      unsubFallback();
    }
  };
}

/**
 * Escuta o histórico recente de leituras para gráficos e análises.
 */
export function observarHistorico(
  callback: (leituras: Leitura[]) => void,
  limiteRegistros = 30,
  dispositivoId = ''
) {
  if (!dispositivoId || !dispositivoId.trim()) {
    callback([]);
    return () => {};
  }

  let unsubFallback: (() => void) | null = null;
  let cancelado = false;

  // 1. Query ideal indexada
  const qPrimaria = query(
    collection(db, "leituras"),
    where("dispositivo_id", "==", dispositivoId),
    orderBy("criado_em", "desc"),
    limit(limiteRegistros)
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
      console.warn(
        "[Firestore] Histórico indexado requer índice composto no console. Ativando fallback cronológico automático...",
        error.message
      );

      // 2. Fallback resiliente
      const qFallback = query(
        collection(db, "leituras"),
        orderBy("criado_em", "desc"),
        limit(Math.max(limiteRegistros * 2, 50))
      );

      unsubFallback = onSnapshot(
        qFallback,
        (snapshot) => {
          if (cancelado) return;
          const filtrados = snapshot.docs
            .map(converterLeitura)
            .filter((item) => item.dispositivo_id === dispositivoId)
            .slice(0, limiteRegistros);

          filtrados.sort((a, b) => (a.criado_em?.getTime() ?? 0) - (b.criado_em?.getTime() ?? 0));
          callback(filtrados);
        },
        (errFallback) => {
          console.warn("[Firestore] Erro no fallback de histórico:", errFallback.message);
        }
      );
    }
  );

  return () => {
    cancelado = true;
    unsubPrimaria();
    if (unsubFallback) {
      unsubFallback();
    }
  };
}
