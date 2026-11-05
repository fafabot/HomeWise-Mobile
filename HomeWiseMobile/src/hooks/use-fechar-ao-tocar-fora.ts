import { useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Fecha um elemento flutuante (ex.: balão do gráfico) quando um toque/clique começa fora dele,
 * sem cobrir a tela: o toque continua chegando ao controle tocado (trocar período, rolar, etc.).
 *
 * Os eventos de início de toque sobem do alvo para os ancestrais: o elemento "dentro" marca o toque
 * antes de a área externa decidir se fecha.
 *  - `propsDentro`: no cartão que contém o elemento flutuante.
 *  - `propsArea`: no contêiner do conteúdo da tela.
 */
export function useFecharAoTocarFora(ativo: boolean, fechar: () => void) {
  const dentro = useRef(false);
  const marcarDentro = () => { dentro.current = true; };
  const verificar = () => {
    const tocouDentro = dentro.current;
    dentro.current = false;
    if (ativo && !tocouDentro) fechar();
  };
  // Na web o mouse não gera touchstart; onMouseDown é repassado pelo react-native-web ao elemento
  const web = Platform.OS === 'web';
  const propsDentro = (web ? { onTouchStart: marcarDentro, onMouseDown: marcarDentro } : { onTouchStart: marcarDentro }) as object;
  const propsArea = (web ? { onTouchStart: verificar, onMouseDown: verificar } : { onTouchStart: verificar }) as object;
  return { propsDentro, propsArea };
}
