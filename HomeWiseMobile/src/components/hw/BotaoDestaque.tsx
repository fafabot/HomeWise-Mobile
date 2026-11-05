import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, alfa } from '@/constants/hw-tema';

/**
 * Botão de destaque azul-petróleo com borda ciano (ex.: "Fazer upgrade para Plus").
 * Estados: hover (somente web), pressionado e desabilitado.
 */
export default function BotaoDestaque({ rotulo, onPress, icone = 'arrow-forward', desabilitado, style }: {
  rotulo: string;
  onPress: () => void;
  icone?: keyof typeof Ionicons.glyphMap;
  desabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [hover, setHover] = useState(false);
  const [pressionado, setPressionado] = useState(false);
  // react-native-web repassa eventos de mouse do TouchableOpacity para o elemento da página.
  const eventosHover = Platform.OS === 'web'
    ? ({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object)
    : {};

  return (
    <TouchableOpacity
      {...eventosHover}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => setPressionado(true)}
      onPressOut={() => setPressionado(false)}
      style={[
        styles.botao,
        hover && !desabilitado && styles.hover,
        pressionado && !desabilitado && styles.pressionado,
        desabilitado && styles.desabilitado,
        style
      ]}
    >
      <Text style={[styles.texto, desabilitado && styles.textoDesabilitado]}>{rotulo}</Text>
      <Ionicons name={icone} size={16} color={desabilitado ? C.textoTer : C.texto} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0b4a5c',
    borderWidth: 1,
    borderColor: alfa(C.marca, 0.55)
  },
  hover: { backgroundColor: '#0e5a70', borderColor: C.marca },
  pressionado: { backgroundColor: '#083a48', borderColor: C.marca, transform: [{ scale: 0.98 }] },
  desabilitado: { backgroundColor: C.superficieAlta, borderColor: C.bordaSuave },
  texto: { color: C.texto, fontSize: 14, fontWeight: '700' },
  textoDesabilitado: { color: C.textoTer }
});
