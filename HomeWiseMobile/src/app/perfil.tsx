import React, { useRef, useState } from 'react';
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
import { deslogarUsuario } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePhoto from '@/components/ProfilePhoto';
import { authErrorMessage } from '@/services/authErrors';

export default function PerfilScreen() {
  const router = useRouter();
  const { user: usuario, perfil, dispositivoId } = useAuth();
  const [saindo, setSaindo] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [erroSaida, setErroSaida] = useState('');
  const [erroSobre, setErroSobre] = useState('');
  const saidaEmAndamento = useRef(false);
  const nomeExibicao = perfil?.nome || usuario?.displayName || usuario?.email?.split('@')[0] || 'Usuário';
  const emailExibicao = usuario?.email || '';

  async function handleSair() {
    if (saidaEmAndamento.current) return;
    saidaEmAndamento.current = true;
    setSaindo(true);
    setErroSaida('');
    try {
      await deslogarUsuario();
    } catch (error) {
      setErroSaida(authErrorMessage(error));
    } finally {
      saidaEmAndamento.current = false;
      setSaindo(false);
    }
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
      badge: 'Sem plano',
      acao: () => router.push('/plano-assinatura')
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7} onPress={() => router.push('/')}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Card do Usuario Conectado ao Firebase */}
        <View style={styles.cardPerfil}>
          <ProfilePhoto nome={nomeExibicao} />
          <Text style={styles.nomeUsuario}>{nomeExibicao}</Text>
          <Text style={styles.emailUsuario}>{emailExibicao}</Text>

          {/* Badge da Central Conectada */}
          <View style={styles.badgeCentral}>
            <Ionicons name="hardware-chip" size={13} color="#38bdf8" />
            <Text style={styles.badgeCentralTexto}>Central: {dispositivoId}</Text>
          </View>

          <TouchableOpacity
            style={styles.botaoEditarPerfil}
            activeOpacity={0.8}
            onPress={() => router.push('/editar-perfil')}
          >
            <Ionicons name="create-outline" size={16} color="#22b7d4" style={{ marginRight: 6 }} />
            <Text style={styles.textoEditarPerfil}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Opcoes com Navegacao Funcional */}
        <View style={styles.menuContainer}>
          {opcoes.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemMenu}
              activeOpacity={0.7}
              onPress={item.acao}
            >
              <View style={styles.itemMenuEsquerda}>
                <Ionicons name={item.icone} size={20} color="#38bdf8" />
                <Text style={styles.itemMenuTitulo}>{item.titulo}</Text>
              </View>
              <View style={styles.itemMenuDireita}>
                {item.badge && <Text style={styles.badgePlano}>{item.badge}</Text>}
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {!!erroSobre && <Text accessibilityRole="alert" style={styles.textoSair}>{erroSobre}</Text>}

        {/* Botao Sair da Conta com Firebase signOut */}
        <TouchableOpacity style={styles.botaoSair} activeOpacity={0.8} accessibilityRole="button" disabled={saindo} onPress={() => { setErroSaida(''); setConfirmandoSaida(true); }}>
          <Ionicons name="log-out-outline" size={18} color="#f87171" style={{ marginRight: 8 }} />
          <Text style={styles.textoSair}>{saindo ? 'Saindo...' : 'Sair da conta'}</Text>
        </TouchableOpacity>

      </ScrollView>
      <Modal visible={confirmandoSaida} transparent animationType="fade" onRequestClose={() => { if (!saidaEmAndamento.current) setConfirmandoSaida(false); }}>
        <View style={styles.fundoModal}>
          <View style={styles.modalSaida} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.tituloHeader}>Sair da conta</Text>
            <Text style={styles.mensagemSaida}>Deseja realmente sair da sua conta HomeWise?</Text>
            {!!erroSaida && <Text accessibilityRole="alert" style={styles.textoSair}>{erroSaida}</Text>}
            <View style={styles.acoesSaida}>
              <TouchableOpacity accessibilityRole="button" style={styles.botaoEditarPerfil} disabled={saindo} onPress={() => setConfirmandoSaida(false)}>
                <Text style={styles.textoEditarPerfil}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[styles.botaoSair, styles.confirmarSaida]} disabled={saindo} onPress={handleSair}>
                <Text style={styles.textoSair}>{saindo ? 'Saindo...' : 'Sair'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalSaida: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0b1d28',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    padding: 24,
    gap: 16
  },
  mensagemSaida: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  acoesSaida: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmarSaida: { marginTop: 0, paddingHorizontal: 24 },
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  botaoVoltar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0e222e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a4b'
  },
  tituloHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  cardPerfil: {
    alignItems: 'center',
    backgroundColor: '#0b1d28',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e3a4b'
  },
  avatarGrande: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  avatarTexto: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold'
  },
  nomeUsuario: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  emailUsuario: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 10
  },
  badgeCentral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#071824',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#183950',
    marginBottom: 16
  },
  badgeCentralTexto: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600'
  },
  botaoEditarPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2b3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#164e63'
  },
  textoEditarPerfil: {
    color: '#22b7d4',
    fontSize: 13,
    fontWeight: '600'
  },
  menuContainer: {
    backgroundColor: '#0b1d28',
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    overflow: 'hidden'
  },
  itemMenu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#122634'
  },
  itemMenuEsquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  itemMenuTitulo: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500'
  },
  itemMenuDireita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  badgePlano: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  botaoSair: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1419',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#451a1a'
  },
  textoSair: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600'
  }
});
