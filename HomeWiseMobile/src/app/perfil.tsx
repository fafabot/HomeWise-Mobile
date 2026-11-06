import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePhoto from '@/components/ProfilePhoto';
import { obterPlanoPorId, temPlanoAtivo } from '@/constants/planos';
import { C, LARGURA_MAXIMA, alfa } from '@/constants/hw-tema';
import CabecalhoTela from '@/components/hw/CabecalhoTela';

export default function PerfilScreen() {
  const router = useRouter();
  const { user: usuario, perfil, dispositivoId, sairDaConta, saindo, erroSaida, assinaturaEstado } = useAuth();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [erroSobre, setErroSobre] = useState('');
  const nomeExibicao = perfil?.nome || usuario?.displayName || usuario?.email?.split('@')[0] || 'Usuário';
  const emailExibicao = usuario?.email || '';
  const planoAtivo = temPlanoAtivo(perfil?.plano, perfil?.status_assinatura)
    ? obterPlanoPorId(perfil?.plano)
    : null;
  const rotuloPlano = assinaturaEstado === 'inconsistente' || assinaturaEstado === 'consultando'
    ? 'Assinatura em verificação' : planoAtivo ? `HomeWise ${planoAtivo.nome}` : 'Sem plano';

  async function handleSair() {
    await sairDaConta();
  }

  async function abrirSobre() {
    setErroSobre('');
    try {
      await openBrowserAsync('https://gbmatheuss.github.io/Homewise_/index.html');
    } catch {
      setErroSobre('Não foi possível abrir a página Sobre. Tente novamente.');
    }
  }

  const opcoes = [
    {
      id: 0,
      titulo: 'Central Vinculada',
      icone: 'hardware-chip-outline' as const,
      badge: dispositivoId,
      acao: () => router.push('/editar-perfil')
    },
    {
      id: 1,
      titulo: 'Editar Perfil',
      icone: 'person-outline' as const,
      acao: () => router.push('/editar-perfil')
    },
    {
      id: 2,
      titulo: 'Alterar Senha',
      icone: 'lock-closed-outline' as const,
      acao: () => router.push('/alterar-senha')
    },
    {
      id: 3,
      titulo: 'Minha residência',
      icone: 'home-outline' as const,
      acao: () => router.push('/editar-perfil')
    },
    {
      id: 4,
      titulo: 'Plano e assinatura',
      icone: 'card-outline' as const,
      badge: rotuloPlano,
      acao: () => router.push('/gerenciar-assinatura')
    },
    {
      id: 5,
      titulo: 'Configurações de alerta',
      icone: 'notifications-outline' as const,
      acao: () => router.push('/alertas')
    },
    {
      id: 6,
      titulo: 'Metas de Consumo',
      icone: 'flag-outline' as const,
      acao: () => router.push('/metas')
    },
    {
      id: 7,
      titulo: 'Sobre',
      icone: 'information-circle-outline' as const,
      acao: abrirSobre
    }
  ];


  // ----- Apenas apresentação: agrupa as mesmas opções em seções -----
  const grupos = [
    { titulo: 'CASA E CENTRAL', ids: [0, 3, 5, 6] },
    { titulo: 'CONTA E PLANO', ids: [1, 2, 4] },
    { titulo: 'SOBRE O APP', ids: [7] }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.conteudo}>

          <CabecalhoTela titulo="Perfil" onVoltar={() => router.push('/')} />

          {/* Cartão do usuário */}
          <View style={styles.cardPerfil}>
            <View style={styles.cardPerfilBrilho} />
            <ProfilePhoto nome={nomeExibicao} />
            <Text style={styles.nomeUsuario}>{nomeExibicao}</Text>
            <Text style={styles.emailUsuario}>{emailExibicao}</Text>

            <View style={styles.chips}>
              <View style={[styles.chip, !dispositivoId && styles.chipAlerta]}>
                <Ionicons name="hardware-chip" size={13} color={dispositivoId ? C.agua : C.alerta} />
                <Text style={[styles.chipTexto, !dispositivoId && { color: C.alerta }]}>
                  {dispositivoId ? `Central: ${dispositivoId}` : 'Nenhuma central vinculada'}
                </Text>
              </View>
              <View style={[styles.chip, planoAtivo ? styles.chipPlano : null]}>
                <Ionicons name={planoAtivo ? 'diamond' : 'diamond-outline'} size={12} color={planoAtivo ? C.marca : C.textoTer} />
                <Text style={[styles.chipTexto, { color: planoAtivo ? C.marca : C.textoSec }]}>{rotuloPlano}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.botaoEditarPerfil}
              activeOpacity={0.8}
              accessibilityRole="button"
              onPress={() => router.push('/editar-perfil')}
            >
              <Ionicons name="create-outline" size={16} color={C.marca} style={{ marginRight: 6 }} />
              <Text style={styles.textoEditarPerfil}>Editar Perfil</Text>
            </TouchableOpacity>
          </View>

          {/* Opções agrupadas */}
          {grupos.map((grupo) => (
            <View key={grupo.titulo}>
              <Text style={styles.tituloGrupo}>{grupo.titulo}</Text>
              <View style={styles.menuContainer}>
                {opcoes.filter((item) => grupo.ids.includes(item.id)).map((item, indice, lista) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemMenu, indice === lista.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.badge ? `${item.titulo}: ${item.badge}` : item.titulo}
                    onPress={item.acao}
                  >
                    <View style={styles.itemMenuEsquerda}>
                      <View style={styles.itemIcone}>
                        <Ionicons name={item.icone} size={18} color={C.marca} />
                      </View>
                      <Text style={styles.itemMenuTitulo} numberOfLines={1}>{item.titulo}</Text>
                    </View>
                    <View style={styles.itemMenuDireita}>
                      {!!item.badge && <Text style={styles.badgePlano} numberOfLines={1}>{item.badge}</Text>}
                      <Ionicons name="chevron-forward" size={18} color={C.textoTer} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {!!erroSobre && <Text accessibilityRole="alert" style={[styles.textoSair, { marginTop: 12 }]}>{erroSobre}</Text>}

          {/* Sair da conta */}
          <TouchableOpacity style={styles.botaoSair} activeOpacity={0.8} accessibilityRole="button" disabled={saindo} onPress={() => setConfirmandoSaida(true)}>
            <Ionicons name="log-out-outline" size={18} color={C.perigo} style={{ marginRight: 8 }} />
            <Text style={styles.textoSair}>{saindo ? 'Saindo...' : 'Sair da conta'}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
      <Modal visible={confirmandoSaida} transparent animationType="fade" onRequestClose={() => { if (!saindo) setConfirmandoSaida(false); }}>
        <View style={styles.fundoModal}>
          <View style={styles.modalSaida} accessibilityViewIsModal>
            <View style={styles.modalIcone}>
              <Ionicons name="log-out-outline" size={22} color={C.perigo} />
            </View>
            <Text accessibilityRole="header" style={styles.tituloModal}>Sair da conta</Text>
            <Text style={styles.mensagemSaida}>Deseja realmente sair da sua conta HomeWise?</Text>
            {!!erroSaida && <Text accessibilityRole="alert" style={styles.textoSair}>Não foi possível sair da conta. Tente novamente.</Text>}
            <View style={styles.acoesSaida}>
              <TouchableOpacity accessibilityRole="button" style={styles.botaoCancelar} disabled={saindo} onPress={() => setConfirmandoSaida(false)}>
                <Text style={styles.textoCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.botaoConfirmarSaida} disabled={saindo} onPress={handleSair}>
                <Text style={styles.textoConfirmarSaida}>{saindo ? 'Saindo...' : 'Sair'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fundo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  conteudo: { width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' },

  cardPerfil: {
    alignItems: 'center',
    backgroundColor: C.superficie,
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.borda,
    overflow: 'hidden'
  },
  cardPerfilBrilho: {
    position: 'absolute',
    top: -140,
    width: 320,
    height: 220,
    borderRadius: 160,
    backgroundColor: alfa(C.marca, 0.1)
  },
  nomeUsuario: { color: C.texto, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2, marginBottom: 2, textAlign: 'center' },
  emailUsuario: { color: C.textoTer, fontSize: 14, marginBottom: 14, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.superficieAlta,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borda
  },
  chipAlerta: { borderColor: alfa(C.alerta, 0.5), backgroundColor: alfa(C.alerta, 0.1) },
  chipPlano: { borderColor: alfa(C.marca, 0.45), backgroundColor: alfa(C.marca, 0.1) },
  chipTexto: { color: C.agua, fontSize: 12, fontWeight: '700' },
  botaoEditarPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alfa(C.marca, 0.1),
    paddingHorizontal: 18,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.35)
  },
  textoEditarPerfil: { color: C.marca, fontSize: 13, fontWeight: '700' },

  tituloGrupo: { color: C.textoTer, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, marginTop: 24, marginBottom: 10, marginLeft: 4 },
  menuContainer: {
    backgroundColor: C.superficie,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borda,
    overflow: 'hidden'
  },
  itemMenu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.bordaSuave
  },
  itemMenuEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  itemIcone: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: alfa(C.marca, 0.1),
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemMenuTitulo: { color: C.texto, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  itemMenuDireita: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  badgePlano: {
    backgroundColor: C.superficieAlta,
    color: C.textoSec,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: 140
  },

  botaoSair: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: alfa(C.perigo, 0.06),
    borderRadius: 16,
    minHeight: 52,
    marginTop: 28,
    borderWidth: 1,
    borderColor: alfa(C.perigo, 0.3)
  },
  textoSair: { color: C.perigo, fontSize: 15, fontWeight: '700' },

  fundoModal: { flex: 1, backgroundColor: 'rgba(2, 8, 12, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSaida: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: C.superficie,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.bordaForte,
    padding: 24,
    gap: 14
  },
  modalIcone: { width: 46, height: 46, borderRadius: 15, backgroundColor: alfa(C.perigo, 0.12), alignItems: 'center', justifyContent: 'center' },
  tituloModal: { color: C.texto, fontSize: 19, fontWeight: '800' },
  mensagemSaida: { color: C.textoSec, fontSize: 15, lineHeight: 22 },
  acoesSaida: { flexDirection: 'row', gap: 10, marginTop: 6 },
  botaoCancelar: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.bordaForte, alignItems: 'center', justifyContent: 'center' },
  textoCancelar: { color: C.texto, fontSize: 15, fontWeight: '600' },
  botaoConfirmarSaida: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#b91c1c', alignItems: 'center', justifyContent: 'center' },
  textoConfirmarSaida: { color: '#ffffff', fontSize: 15, fontWeight: '700' }
});
