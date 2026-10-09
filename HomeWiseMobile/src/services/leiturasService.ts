import {
  collection,
  query,
  where,
  limit,
  onSnapshot
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

const DEFAULT_DEVICE_ID = "central_homewise_01";

/**
 * Escuta a ultima leitura em tempo real.
 * Usa ordenacao local simples quando o indice composto ainda nao estiver pronto no Firestore.
 */
export function observarUltimaLeitura(
  callback: (leitura: Leitura | null) => void,
  dispositivoId = DEFAULT_DEVICE_ID
) {
  const q = query(
    collection(db, "leituras"),
    where("dispositivo_id", "==", dispositivoId),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            dispositivo_id: data.dispositivo_id,
            consumo_agua_litros: Number(data.consumo_agua_litros || 0),
            vazao_l_min: Number(data.vazao_l_min || 0),
            potencia_w: Number(data.potencia_w || 0),
            energia_kwh: Number(data.energia_kwh || 0),
            tensao_v: Number(data.tensao_v || 0),
            criado_em: data.criado_em?.toDate ? data.criado_em.toDate() : new Date()
          };
        });

        // Ordena pela leitura mais recente
        docs.sort((a, b) => b.criado_em.getTime() - a.criado_em.getTime());
        callback(docs[0]);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn("[Firestore] Erro ao escutar leituras:", error.message);
    }
  );
}

/**
 * Escuta o historico recente de leituras para graficos e analises
 */
export function observarHistorico(
  callback: (leituras: Leitura[]) => void,
  limiteRegistros = 30,
  dispositivoId = DEFAULT_DEVICE_ID
) {
  const q = query(
    collection(db, "leituras"),
    where("dispositivo_id", "==", dispositivoId),
    limit(limiteRegistros)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const lista: Leitura[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        lista.push({
          id: doc.id,
          dispositivo_id: data.dispositivo_id,
          consumo_agua_litros: Number(data.consumo_agua_litros || 0),
          vazao_l_min: Number(data.vazao_l_min || 0),
          potencia_w: Number(data.potencia_w || 0),
          energia_kwh: Number(data.energia_kwh || 0),
          tensao_v: Number(data.tensao_v || 0),
          criado_em: data.criado_em?.toDate ? data.criado_em.toDate() : new Date()
        });
      });

      // Ordena em ordem cronologica (antigo para recente)
      lista.sort((a, b) => (a.criado_em?.getTime() ?? 0) - (b.criado_em?.getTime() ?? 0));
      callback(lista);
    },
    (error) => {
      console.warn("[Firestore] Erro ao buscar historico:", error.message);
    }
  );
}
