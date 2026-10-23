import { useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useAuth } from '@/contexts/AuthContext';
import { salvarPerfilFirestore } from '@/services/authService';

export default function ProfilePhoto({ nome, size = 80, disabled = false }: { nome: string; size?: number; disabled?: boolean }) {
  const { user, perfil } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const escolhendo = useRef(false);
  const foto = perfil?.foto_perfil;
  const iniciais = nome.trim().split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase() || 'HW';

  async function escolherFoto() {
    if (!user || escolhendo.current || disabled) return;
    escolhendo.current = true;
    setErro('');
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (resultado.canceled) return;
      setSalvando(true);
      const asset = resultado.assets[0];
      const lado = Math.min(asset.width, asset.height);
      const contexto = ImageManipulator.manipulate(asset.uri);
      contexto.crop({ originX: (asset.width - lado) / 2, originY: (asset.height - lado) / 2, width: lado, height: lado });
      contexto.resize({ width: 256, height: 256 });
      const imagem = await contexto.renderAsync();
      const compactada = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      // Store a small, durable avatar rather than a temporary file URI.
      if (!compactada.base64 || compactada.base64.length > 250_000) throw new Error('image-too-large');
      const salvo = await salvarPerfilFirestore(user.uid, { foto_perfil: `data:image/jpeg;base64,${compactada.base64}` });
      if (!salvo) throw new Error('save-failed');
    } catch {
      setErro('Não foi possível atualizar a foto. Verifique o acesso às fotos e tente novamente.');
    } finally {
      escolhendo.current = false;
      setSalvando(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={foto ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'} accessibilityState={{ disabled: disabled || salvando, busy: salvando }} disabled={disabled || salvando} onPress={escolherFoto}>
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
          {foto ? <Image source={{ uri: foto }} style={styles.imagem} resizeMode="cover" /> : <Text style={styles.iniciais}>{iniciais}</Text>}
          {salvando && <View style={styles.overlay}><ActivityIndicator color="#fff" /></View>}
        </View>
        <View style={styles.camera}><Ionicons name="camera" size={16} color="#fff" /></View>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={disabled || salvando} onPress={escolherFoto} style={styles.link}>
        <Text style={styles.texto}>{salvando ? 'Salvando foto...' : foto ? 'Trocar foto' : 'Adicionar foto'}</Text>
      </TouchableOpacity>
      {!!erro && <Text accessibilityRole="alert" style={styles.erro}>{erro}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 12 },
  avatar: { backgroundColor: '#0284c7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imagem: { width: '100%', height: '100%' },
  iniciais: { color: '#fff', fontSize: 28, fontWeight: '800' },
  camera: { position: 'absolute', right: -3, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#0ea5e9', borderWidth: 2, borderColor: '#07131b', alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  link: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  texto: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },
  erro: { color: '#f87171', textAlign: 'center', marginTop: 8, fontSize: 12 },
});