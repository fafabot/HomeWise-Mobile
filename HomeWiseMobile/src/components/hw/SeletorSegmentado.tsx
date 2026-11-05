import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, alfa } from '@/constants/hw-tema';

export type OpcaoSegmento<K extends string> = { chave: K; rotulo: string; bloqueado?: boolean };

/** Controle segmentado acessível. Apenas apresenta; a regra de cada opção fica na tela. */
export default function SeletorSegmentado<K extends string>({ opcoes, ativo, onSelecionar, cor = C.marca, rotuloGrupo }: {
  opcoes: OpcaoSegmento<K>[];
  ativo: K;
  onSelecionar: (chave: K) => void;
  cor?: string;
  rotuloGrupo?: string;
}) {
  return (
    <View style={styles.barra} accessibilityRole="tablist" accessibilityLabel={rotuloGrupo}>
      {opcoes.map((opcao) => {
        const selecionado = opcao.chave === ativo;
        return (
          <TouchableOpacity
            key={opcao.chave}
            style={[styles.botao, selecionado && { backgroundColor: alfa(cor, 0.16), borderColor: alfa(cor, 0.5) }]}
            activeOpacity={0.75}
            onPress={() => onSelecionar(opcao.chave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selecionado }}
            accessibilityLabel={opcao.bloqueado ? `${opcao.rotulo}, disponível no plano Plus` : opcao.rotulo}
          >
            <Text style={[styles.texto, selecionado && { color: C.texto }]}>{opcao.rotulo}</Text>
            {opcao.bloqueado && <Ionicons name="lock-closed" size={11} color={C.marca} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: C.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.bordaSuave,
    padding: 4,
    gap: 4,
    marginBottom: 16
  },
  botao: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  texto: { color: C.textoTer, fontSize: 13, fontWeight: '700' }
});
