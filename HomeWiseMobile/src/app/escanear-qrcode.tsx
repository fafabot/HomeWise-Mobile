import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_BOX_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

function extrairCodigoCentral(dadosBrutos: string): string {
  const limpo = dadosBrutos.trim();
  // Trata URLs ou deep links caso o QR Code contenha parâmetros (ex: homewise://pair?device=central_01)
  if (limpo.includes('device=')) {
    const match = limpo.match(/device=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  if (limpo.startsWith('homewise://')) {
    return limpo.replace('homewise://', '').replace('pair/', '').trim();
  }
  return limpo;
}

export default function EscanearQRCodeScreen() {
  const router = useRouter();
  const { atualizarDispositivoId } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [tochaAtiva, setTochaAtiva] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Tratamento de permissão enquanto carrega
  if (!permission) {
    return (
      <View style={[styles.container, styles.centralizado]}>
        <ActivityIndicator color="#22d3ee" size="large" />
      </View>
    );
  }

  // Tela de solicitação de permissão de câmera
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.centralizado, { paddingHorizontal: 32 }]}>
        <StatusBar barStyle="light-content" backgroundColor="#07131b" />
        <View style={styles.iconePermissao}>
          <Ionicons name="camera-outline" size={48} color="#22d3ee" />
        </View>
        <Text style={styles.tituloPermissao}>Acesso à Câmera</Text>
        <Text style={styles.textoPermissao}>
          Para ler o QR Code da sua Central HomeWise e pareá-la automaticamente com sua conta, precisamos de permissão para utilizar a câmera do seu aparelho.
        </Text>
        <TouchableOpacity style={styles.botaoPermissao} activeOpacity={0.8} onPress={requestPermission}>
          <Ionicons name="shield-checkmark" size={18} color="#07131b" style={{ marginRight: 8 }} />
          <Text style={styles.textoBotaoPermissao}>Permitir Acesso à Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoVoltarSimples} onPress={() => router.back()}>
          <Text style={styles.textoVoltarSimples}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scanned || salvando) return;
    setScanned(true);

    const codigo = extrairCodigoCentral(result.data);
    if (!codigo) {
      Alert.alert(
        'QR Code Inválido',
        'Não foi possível identificar o código da central no QR Code escaneado.',
        [{ text: 'Tentar Novamente', onPress: () => setScanned(false) }]
      );
      return;
    }

    setSalvando(true);
    const sucesso = await atualizarDispositivoId(codigo);
    setSalvando(false);

    if (sucesso) {
      Alert.alert(
        'Central Conectada!',
        `A central "${codigo}" foi vinculada com sucesso à sua conta.\nSuas medições em tempo real já estão ativas.`,
        [
          {
            text: 'Ver Painel',
            onPress: () => router.replace('/')
          }
        ]
      );
    } else {
      Alert.alert(
        'Erro ao Vincular',
        'Ocorreu uma falha ao salvar a central no seu perfil. Tente novamente.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Câmera em Tela Cheia */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={tochaAtiva}
        barcodeScannerSettings={{
          barcodeTypes: ['qr']
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay Escuro com Janela Central Transparente */}
      <SafeAreaView style={styles.overlay}>
        {/* Barra Superior */}
        <View style={styles.topoBarra}>
          <TouchableOpacity style={styles.botaoCircular} activeOpacity={0.7} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.tituloTopo}>Escanear QR Code</Text>
          <TouchableOpacity
            style={[styles.botaoCircular, tochaAtiva && styles.botaoCircularAtivo]}
            activeOpacity={0.7}
            onPress={() => setTochaAtiva(!tochaAtiva)}
          >
            <Ionicons name={tochaAtiva ? 'flash' : 'flash-off'} size={20} color={tochaAtiva ? '#22d3ee' : '#ffffff'} />
          </TouchableOpacity>
        </View>

        {/* Retícula / Moldura Central de Foco */}
        <View style={styles.conteinerCentro}>
          <View style={styles.reticula}>
            {/* Cantoneiras Estilizadas da Moldura */}
            <View style={[styles.cantoneira, styles.cantoSuperiorEsquerdo]} />
            <View style={[styles.cantoneira, styles.cantoSuperiorDireito]} />
            <View style={[styles.cantoneira, styles.cantoInferiorEsquerdo]} />
            <View style={[styles.cantoneira, styles.cantoInferiorDireito]} />

            {salvando && (
              <View style={styles.overlaySalvando}>
                <ActivityIndicator color="#22d3ee" size="large" />
                <Text style={styles.textoSalvando}>Vinculando central...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Instruções Inferiores */}
        <View style={styles.rodape}>
          <View style={styles.badgeDica}>
            <Ionicons name="scan-outline" size={16} color="#38bdf8" />
            <Text style={styles.dicaTexto}>Aponte para o QR Code da Central HomeWise</Text>
          </View>
          <Text style={styles.subDica}>
            O código será lido automaticamente ao ser enquadrado na moldura.
          </Text>

          <TouchableOpacity
            style={styles.botaoDigitarManual}
            activeOpacity={0.7}
            onPress={() => router.replace('/editar-perfil')}
          >
            <Ionicons name="create-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
            <Text style={styles.textoDigitarManual}>Prefere digitar o código manualmente?</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131b'
  },
  centralizado: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7, 19, 27, 0.45)'
  },
  topoBarra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10
  },
  tituloTopo: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  botaoCircular: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(14, 34, 46, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  botaoCircularAtivo: {
    backgroundColor: 'rgba(34, 211, 238, 0.25)',
    borderColor: '#22d3ee'
  },
  conteinerCentro: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  reticula: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cantoneira: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#22d3ee'
  },
  cantoSuperiorEsquerdo: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10
  },
  cantoSuperiorDireito: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10
  },
  cantoInferiorEsquerdo: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10
  },
  cantoInferiorDireito: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10
  },
  overlaySalvando: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 19, 27, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8
  },
  textoSalvando: {
    color: '#22d3ee',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600'
  },
  rodape: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: 'center'
  },
  badgeDica: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 34, 46, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e3a4b',
    marginBottom: 8,
    gap: 8
  },
  dicaTexto: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600'
  },
  subDica: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16
  },
  botaoDigitarManual: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  textoDigitarManual: {
    color: '#94a3b8',
    fontSize: 13,
    textDecorationLine: 'underline'
  },
  iconePermissao: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)'
  },
  tituloPermissao: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  textoPermissao: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28
  },
  botaoPermissao: {
    flexDirection: 'row',
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 14
  },
  textoBotaoPermissao: {
    color: '#07131b',
    fontSize: 15,
    fontWeight: 'bold'
  },
  botaoVoltarSimples: {
    paddingVertical: 10
  },
  textoVoltarSimples: {
    color: '#64748b',
    fontSize: 14
  }
});
