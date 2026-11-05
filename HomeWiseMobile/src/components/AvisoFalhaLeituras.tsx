import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mensagemErroLeituras, type FonteRotulada } from '@/hooks/use-leituras-central';

function listar(itens: string[]) {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** Aviso de falha nas consultas da central, com ação explícita para recriar as assinaturas com erro. */
export default function AvisoFalhaLeituras({ fontes, onTentarNovamente }: { fontes: FonteRotulada[]; onTentarNovamente: () => void }) {
  const falhas = fontes.filter(({ fonte }) => fonte.estado === 'erro');
  if (falhas.length === 0) return null;

  const rotulos = falhas.map(({ rotulo }) => rotulo);
  const desatualizado = falhas.some(({ fonte }) => fonte.desatualizado);
  // Mensagens diferentes são listadas; repetidas (ex.: mesma falha de conexão) aparecem uma vez.
  const mensagens = [...new Set(falhas.map(({ fonte }) => mensagemErroLeituras(fonte.erro)))];

  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.topo}>
        <Ionicons name="alert-circle-outline" size={18} color="#f87171" />
        <Text style={styles.titulo}>Falha ao carregar {listar(rotulos)}</Text>
      </View>
      {mensagens.map((mensagem) => <Text key={mensagem} style={styles.texto}>{mensagem}</Text>)}
      <Text style={styles.texto}>
        {desatualizado
          ? 'Os valores marcados como desatualizados mostram os últimos dados recebidos. Os que dependem dessa consulta sem dados ficam indisponíveis.'
          : 'Os indicadores que dependem dessa consulta ficam indisponíveis até ela ser restabelecida.'}
      </Text>
      <TouchableOpacity
        style={styles.botao}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Tentar carregar novamente: ${listar(rotulos)}`}
        onPress={onTentarNovamente}
      >
        <Ionicons name="refresh" size={14} color="#ffffff" style={{ marginRight: 6 }} />
        <Text style={styles.textoBotao}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Selo para indicadores exibidos com dados anteriores a uma falha. */
export function SeloDesatualizado({ visivel }: { visivel: boolean }) {
  if (!visivel) return null;
  return (
    <View style={styles.selo} accessibilityLabel="Valor desatualizado">
      <Ionicons name="time-outline" size={11} color="#facc15" />
      <Text style={styles.textoSelo}>Desatualizado</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#261414',
    borderColor: '#7f1d1d',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  titulo: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: 'bold',
    flexShrink: 1
  },
  texto: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4
  },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    minHeight: 40
  },
  textoBotao: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600'
  },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#2e2009',
    borderColor: '#854d0e',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4
  },
  textoSelo: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '600'
  }
});
