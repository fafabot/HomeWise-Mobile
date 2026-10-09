import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from "firebase/firestore";
import { db } from "./firebaseConfig";

const COLECAO_LEITURAS = "leituras";
const DISPOSITIVO_PADRAO = "central_homewise_01";

/**
 * Escuta em TEMPO REAL a ultima leitura enviada pelo ESP8266
 * @param {function} callback Funcao que recebe o objeto com os dados em tempo real
 * @param {string} dispositivoId ID do dispositivo da central
 * @returns {function} Funcao de cancelamento (unsubscribe) para usar no cleanup do useEffect
 */
export function observarUltimaLeitura(callback, dispositivoId = DISPOSITIVO_PADRAO) {
  const q = query(
    collection(db, COLECAO_LEITURAS),
    where("dispositivo_id", "==", dispositivoId),
    orderBy("criado_em", "desc"),
    limit(1)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const dados = doc.data();
        callback({
          id: doc.id,
          ...dados,
          criado_em: dados.criado_em ? dados.criado_em.toDate() : new Date()
        });
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("[Firestore] Erro ao escutar leitura em tempo real:", error);
    }
  );
}

/**
 * Consulta o historico recente de leituras para graficos
 * @param {number} limiteQuantidade Quantidade de registros (ex: 30)
 * @param {string} dispositivoId ID do dispositivo
 */
export async function buscarHistorico(limiteQuantidade = 30, dispositivoId = DISPOSITIVO_PADRAO) {
  try {
    const q = query(
      collection(db, COLECAO_LEITURAS),
      where("dispositivo_id", "==", dispositivoId),
      orderBy("criado_em", "desc"),
      limit(limiteQuantidade)
    );

    const snapshot = await getDocs(q);
    const lista = [];

    snapshot.forEach((doc) => {
      const dados = doc.data();
      lista.push({
        id: doc.id,
        ...dados,
        criado_em: dados.criado_em ? dados.criado_em.toDate() : new Date()
      });
    });

    return lista.reverse(); // Ordem cronologica para graficos
  } catch (error) {
    console.error("[Firestore] Erro ao buscar historico:", error);
    return [];
  }
}

