import { doc, getDoc } from 'firebase/firestore';
import { planos } from '@/constants/planos';
import { db } from '@/services/firebase';

export interface PlanoAtivo {
  id: string;
  nome: string;
}

export async function consultarPlanoAtivo(uid: string): Promise<PlanoAtivo | null> {
  if (!uid.trim()) throw new Error('Usuário não autenticado para consultar assinatura.');

  const snapshot = await getDoc(doc(db, 'usuarios', uid));
  if (!snapshot.exists()) return null;

  const dados = snapshot.data();
  const planoId = typeof dados.plano_id === 'string' ? dados.plano_id.trim() : '';
  if (!planoId) return null;

  const status = typeof dados.plano_status === 'string' ? dados.plano_status.trim().toLowerCase() : '';
  const ativo = !status || status === 'ativo' || status === 'active';
  if (!ativo) return null;

  const planoConhecido = planos.find(item => item.id === planoId);
  return {
    id: planoId,
    nome: planoConhecido?.nome || 'Plano já associado'
  };
}
