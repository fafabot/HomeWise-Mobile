import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

export function usePanelMotion() {
  const offset = useRef(new Animated.Value(70)).current;
  const reducedMotion = useRef(false);
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reducedMotion.current = value; });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!active) return;
      reducedMotion.current = value;
      if (value) offset.setValue(0);
      else Animated.spring(offset, { toValue: 0, damping: 19, stiffness: 150, mass: 0.9, useNativeDriver: true }).start();
    }).catch(() => { if (active) offset.setValue(0); });
    return () => { active = false; subscription.remove(); offset.stopAnimation(); };
  }, [offset]);

  const press = () => new Promise<void>((resolve) => {
    if (reducedMotion.current) return resolve();
    Animated.sequence([
      Animated.timing(offset, { toValue: -18, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(offset, { toValue: 0, damping: 16, stiffness: 190, mass: 0.7, useNativeDriver: true }),
    ]).start(() => resolve());
  });
  const close = (onClosed: () => void) => {
    if (reducedMotion.current) return onClosed();
    Animated.timing(offset, { toValue: 110, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onClosed(); });
  };
  return { style: { transform: [{ translateY: offset }], opacity: offset.interpolate({ inputRange: [0, 110], outputRange: [1, 0], extrapolate: 'clamp' }) }, press, close };
}
