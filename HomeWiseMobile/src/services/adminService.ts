import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface UsuarioVinculadoCentral {
  uid: string;
  nome: string;
  email: string;
  perfil_acesso?: string;
}

export interface ResumoCentralAdmin {
  dispositivoId: string;
  ultimaData: string;
  ultimoConsumoAguaLitros: number;
  ultimaEnergiaKwh: number;
  mediaTensaoV: number;
  diasRegistrados: number;
  usuariosVinculados: UsuarioVinculadoCentral[];
}

/**
 * Consulta no Cloud Firestore todas as centrais HomeWise que possuem histórico
 * consolidado ou usuários vinculados, permitindo ao Administrador inspecionar
 * e alternar entre qualquer central cadastrada (RF04 / RF08 / RF14).
 */
export async function listarCentraisAdmin(
  centralPadrao?: string
): Promise<ResumoCentralAdmin[]> {
  const mapa = new Map<string, ResumoCentralAdmin>();

  const garantirCentral = (idBruto?: string): ResumoCentralAdmin | null => {
    const id = (idBruto || '').trim();
    if (!id) return null;
    let item = mapa.get(id);
    if (!item) {
      item = {
        dispositivoId: id,
        ultimaData: '',
        ultimoConsumoAguaLitros: 0,
        ultimaEnergiaKwh: 0,
        mediaTensaoV: 0,
        diasRegistrados: 0,
        usuariosVinculados: []
      };
      mapa.set(id, item);
    }
    return item;
  };

  if (centralPadrao?.trim()) {
    garantirCentral(centralPadrao);
  }

  try {
    const snapDiario = await getDocs(collection(db, 'consumo_diario'));
    snapDiario.forEach((docSnap) => {
      const d = docSnap.data();
      const central = garantirCentral(d?.dispositivo_id);
      if (!central) return;

      central.diasRegistrados += 1;
      const dataStr = typeof d?.data === 'string' ? d.data : '';
      if (dataStr >= central.ultimaData) {
        central.ultimaData = dataStr;
        central.ultimoConsumoAguaLitros = Number(d?.consumo_agua_litros || 0);
        central.ultimaEnergiaKwh = Number(d?.energia_kwh || 0);
        central.mediaTensaoV = Number(d?.media_tensao_v || 0);
      }
    });
  } catch (err) {
    console.warn('[AdminService] Falha ao listar consumo_diario:', err);
  }

  try {
    const snapUsuarios = await getDocs(collection(db, 'usuarios'));
    snapUsuarios.forEach((docSnap) => {
      const u = docSnap.data();
      const central = garantirCentral(u?.dispositivo_id);
      if (!central) return;

      central.usuariosVinculados.push({
        uid: u?.uid || docSnap.id,
        nome: u?.nome || 'Usuário',
        email: u?.email || '',
        perfil_acesso: u?.perfil_acesso || 'morador'
      });
    });
  } catch {
    // Caso a regra restrinja listagem global de usuários para um perfil de suporte, mantém os dados de telemetria
  }

  return Array.from(mapa.values()).sort((a, b) => {
    if (centralPadrao && a.dispositivoId === centralPadrao) return -1;
    if (centralPadrao && b.dispositivoId === centralPadrao) return 1;
    return b.ultimaData.localeCompare(a.ultimaData) || a.dispositivoId.localeCompare(b.dispositivoId);
  });
}
