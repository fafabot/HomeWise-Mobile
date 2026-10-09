import {
  collection,
  query,
  where,
  orderBy,
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
 * Escuta a ultima leitura em tempo real
 */
export function observarUltimaLeitura(callback: (leitura: Leitura | null) => void, dispositivoId = DEFAULT_DEVICE_ID) {
  const q = query(
    collection(db, "leituras"),
    where("dispositivo_id", "==", dispositivoId),
    orderBy("criado_em", "desc"),
    limit(1)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        callback({
          id: doc.id,
          dispositivo_id: data.dispositivo_id,
          consumo_agua_litros: Number(data.consumo_agua_litros || 0),
          vazao_l_min: Number(data.vazao_l_min || 0),
          potencia_w: Number(data.potencia_w || 0),
          energia_kwh: Number(data.energia_kwh || 0),
          tensao_v: Number(data.tensao_v || 0),
          criado_em: data.criado_em?.toDate ? data.criado_em.toDate() : new Date()
        });
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn("[Firestore] Aviso ao escutar leitura:", error.message);
    }
  );
}

