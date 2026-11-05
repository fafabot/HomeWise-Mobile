import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** true quando o sistema pede menos animações (ou até a preferência ser conhecida). */
export function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(true);
  useEffect(() => {
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => { if (ativo) setReduzido(valor); })
      .catch(() => { if (ativo) setReduzido(false); });
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => { ativo = false; assinatura.remove(); };
  }, []);
  return reduzido;
}
