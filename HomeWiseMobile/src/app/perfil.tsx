import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { obterUsuarioAtual, deslogarUsuario, observarAuth } from '@/services/authService';

export default function PerfilScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(obterUsuarioAtual());

  useEffect(() => {
    const unsub = observarAuth((u) => {
      setUsuario(u);
    });
    return () => unsub();
  }, []);

  const nomeExibicao = usuario?.displayName || 'Matheus Luiz';
  const emailExibicao = usuario?.email || 'matheus.luiz@gmail.com';
  const iniciais = nomeExibicao.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  async function handleSair() {
    Alert.alert(
      'Sair da conta',
      'Deseja realmente sair da sua conta HomeWise?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await deslogarUsuario();
            router.push('/');
          }
        }
      ]
    );
  }

  const opcoes = [
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
      badge: 'Plus',
      acao: () => Alert.alert('Plano HomeWise', 'Você está utilizando o plano Plus com monitoramento em tempo real!')
    },
    {
      id: 5,
      titulo: 'Configurações de alerta',
      icone: 'notifications-outline' as const,
      acao: () => router.push('/alertas')
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
          <View style={styles.avatarGrande}>
            <Text style={styles.avatarTexto}>{iniciais}</Text>
          </View>
          <Text style={styles.nomeUsuario}>{nomeExibicao}</Text>
          <Text style={styles.emailUsuario}>{emailExibicao}</Text>

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

        {/* Botao Sair da Conta com Firebase signOut */}
        <TouchableOpacity style={styles.botaoSair} activeOpacity={0.8} onPress={handleSair}>
          <Ionicons name="log-out-outline" size={18} color="#f87171" style={{ marginRight: 8 }} />
          <Text style={styles.textoSair}>Sair da conta</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderColor: '#133547',
    marginBottom: 24
  },
  avatarGrande: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1b3b4f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22b7d4',
    marginBottom: 14
  },
  avatarTexto: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold'
  },
  nomeUsuario: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  emailUsuario: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16
  },
  botaoEditarPerfil: {
    backgroundColor: '#0e222e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    flexDirection: 'row',
    alignItems: 'center'
  },
  textoEditarPerfil: {
    color: '#22b7d4',
    fontSize: 13,
    fontWeight: '600'
  },
  menuContainer: {
    backgroundColor: '#0b1d28',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#133547',
    marginBottom: 20
  },
  itemMenu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#132838'
  },
  itemMenuEsquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  itemMenuTitulo: {
    color: '#e2e8f0',
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
    borderRadius: 6
  },
  botaoSair: {
    backgroundColor: '#261414',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d'
  },
  textoSair: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: 'bold'
  }
});
