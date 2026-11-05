import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { obterPlanoPorId, planos, temPlanoAtivo } from '@/constants/planos';
import { PlanBenefits, PlanPrice, SubscriptionScreen, subscriptionStyles as s } from '@/components/SubscriptionUI';

export default function PlanoAssinaturaScreen() {
  const router = useRouter();
  const { user, perfil, cancelarAssinatura } = useAuth();
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const nome = (perfil?.nome || user?.displayName || user?.email?.split('@')[0] || 'você').split(' ')[0];

  const ativo = temPlanoAtivo(perfil?.plano, perfil?.status_assinatura);
  const planoAtual = ativo ? obterPlanoPorId(perfil?.plano) : null;
  const cicloAtual = perfil?.ciclo_assinatura === 'anual' ? 'anual' : 'mensal';

  async function handleCancelar() {
    setCancelando(true);
    try {
      await cancelarAssinatura();
      setConfirmandoCancelamento(false);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <SubscriptionScreen title="Plano e assinatura" onBack={() => router.replace('/perfil')}>
      <Text style={s.eyebrow}>SEU HOMEWISE</Text>
      <Text style={s.title}>Mais controle para sua casa.</Text>
      <Text style={s.subtitle}>
        {planoAtual
          ? `Olá, ${nome}. Sua assinatura HomeWise ${planoAtual.nome} está ativa e sincronizada com sua conta.`
          : `Olá, ${nome}. Você ainda não tem um plano contratado. Conheça as opções para sua casa.`}
      </Text>

      <View style={[s.card, s.featured]}>
        <View style={s.cardTop}>
          <View style={s.icon}>
            <Ionicons name={planoAtual ? planoAtual.icone : 'layers-outline'} size={24} color="#38bdf8" />
          </View>
          <View style={[s.badge, planoAtual && styles.badgeAtivo]}>
            <Text style={[s.badgeText, planoAtual && { color: '#4ade80' }]}>{planoAtual ? `PLANO ATIVO • ${cicloAtual.toUpperCase()}` : 'SEM PLANO'}</Text>
          </View>
        </View>
        <Text style={s.planName}>{planoAtual ? `HomeWise ${planoAtual.nome}` : 'Nenhum plano contratado'}</Text>
        <Text style={[s.description, { marginBottom: planoAtual ? 16 : 24 }]}>
          {planoAtual
            ? `Valor atual: R$ ${cicloAtual === 'anual' ? planoAtual.precoAnual : planoAtual.preco}/mês • Sem fidelidade.`
            : 'Compare os preços e benefícios e encontre a opção ideal para você.'}
        </Text>
        {planoAtual && (
          <>
            <View style={s.divider} />
            <PlanBenefits items={planoAtual.beneficios} />
          </>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          style={s.primary}
          onPress={() => router.push('/gerenciar-assinatura')}
        >
          <Text style={s.primaryText}>{planoAtual ? 'Trocar de plano ou ciclo' : 'Escolher um plano'}</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
        {planoAtual && (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.cancelButton}
            onPress={() => setConfirmandoCancelamento(true)}
          >
            <Text style={styles.cancelButtonText}>Cancelar assinatura</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.sectionTitle}>Comparativo de planos</Text>
      <Text style={s.sectionDescription}>Todos os planos têm renovação sem fidelidade e ativação imediata.</Text>
      {planos.map(plano => {
        const ehAtual = planoAtual?.id === plano.id;
        return (
          <View key={plano.id} style={[s.card, { marginBottom: 16 }, ehAtual && s.featured]}>
            <View style={s.cardTop}>
              <Text style={s.planName}>{plano.nome}</Text>
              {ehAtual && (
                <View style={[s.badge, styles.badgeAtivo]}>
                  <Text style={[s.badgeText, { color: '#4ade80' }]}>SEU PLANO</Text>
                </View>
              )}
            </View>
            <Text style={s.description}>{plano.descricao}</Text>
            <PlanPrice value={plano.preco} />
            <View style={s.divider} />
            <PlanBenefits items={plano.beneficios} />
            <TouchableOpacity
              accessibilityRole="button"
              style={ehAtual ? s.secondary : s.primary}
              onPress={() => router.push({ pathname: '/gerenciar-assinatura', params: ehAtual ? {} : { checkout: plano.id } })}
            >
              <Text style={ehAtual ? s.secondaryText : s.primaryText}>
                {ehAtual ? 'Gerenciar este plano' : `Assinar ${plano.nome}`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={s.note}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#38bdf8" />
        <Text style={s.noteText}>Sem fidelidade: altere ou cancele sua assinatura quando quiser pelo app ou pelo site.</Text>
      </View>

      <Modal
        visible={confirmandoCancelamento}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!cancelando) setConfirmandoCancelamento(false); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Cancelar assinatura?</Text>
            <Text style={styles.modalDesc}>
              Ao cancelar, recursos exclusivos como metas mensais e relatórios anuais voltarão a ficar restritos. Você pode reativar quando quiser.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalKeepBtn}
                disabled={cancelando}
                onPress={() => setConfirmandoCancelamento(false)}
              >
                <Text style={styles.modalKeepText}>Manter plano</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                disabled={cancelando}
                onPress={() => void handleCancelar()}
              >
                {cancelando ? (
                  <ActivityIndicator color="#fca5a5" size="small" />
                ) : (
                  <Text style={styles.modalCancelText}>Confirmar cancelamento</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SubscriptionScreen>
  );
}

const styles = StyleSheet.create({
  badgeAtivo: {
    borderColor: '#22c55e88',
    backgroundColor: '#14532d66',
  },
  cancelButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0b1d28',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
  },
  modalDesc: {
    color: '#94aab4',
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalKeepBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#0f2b3c',
    borderWidth: 1,
    borderColor: '#164e63',
  },
  modalKeepText: {
    color: '#22b7d4',
    fontWeight: '600',
    fontSize: 13,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#3b181c',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  modalCancelText: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 13,
  },
});
