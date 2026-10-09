import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PerfilScreen() {
  const opcoes: {
    id: number;
    titulo: string;
    icone: keyof typeof Ionicons.glyphMap;
    badge?: string;
  }[] = [
    { id: 1, titulo: 'Dados Pessoais', icone: 'person-outline' },
    { id: 2, titulo: 'Minha residência', icone: 'home-outline' },
    { id: 3, titulo: 'Plano e assinatura', icone: 'card-outline', badge: 'Plus' },
    { id: 4, titulo: 'Alterar senha', icone: 'lock-closed-outline' },
    { id: 5, titulo: 'Configurações de alerta', icone: 'notifications-outline' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07131b" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Perfil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Card do Usuario */}
        <View style={styles.cardPerfil}>
          <View style={styles.avatarGrande}>
            <Text style={styles.avatarTexto}>ML</Text>
          </View>
          <Text style={styles.nomeUsuario}>Matheus Luiz</Text>
          <Text style={styles.emailUsuario}>matheus.luiz@gmail.com</Text>

          <TouchableOpacity style={styles.botaoEditarPerfil} activeOpacity={0.8}>
            <Text style={styles.textoEditarPerfil}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Opcoes do Perfil */}
        <View style={styles.menuContainer}>
          {opcoes.map((item) => (
            <TouchableOpacity key={item.id} style={styles.itemMenu} activeOpacity={0.7}>
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

        {/* Botao Sair da Conta */}
        <TouchableOpacity style={styles.botaoSair} activeOpacity={0.8}>
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
    borderColor: '#1e3a4b'
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
