import { useState, useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from './useAccessibility';

export type TransitionState = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited';

interface UseTransitionOptions {
  duration?: number;
  enterDuration?: number;
  exitDuration?: number;
  onEnter?: () => void;
  onEntering?: () => void;
  onEntered?: () => void;
  onExit?: () => void;
  onExiting?: () => void;
  onExited?: () => void;
}

export function useTransition(
  inProp: boolean,
  options: UseTransitionOptions = {}
) {
  const {
    duration = 300,
    enterDuration,
    exitDuration,
    onEnter,
    onEntering,
    onEntered,
    onExit,
    onExiting,
    onExited,
  } = options;

  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<TransitionState>(
    inProp ? 'entered' : 'idle'
  );
  const rafRef = useRef<number>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const effectiveDuration = prefersReducedMotion ? 0 : (duration || 300);

  useEffect(() => {
    if (inProp) {
      setState('entering');
      onEnter?.();

      timeoutRef.current = setTimeout(() => {
        setState('entered');
        onEntered?.();
      }, effectiveDuration);
    } else {
      if (state === 'idle' || state === 'exited') return;

      setState('exiting');
      onExit?.();

      timeoutRef.current = setTimeout(() => {
        setState('exited');
        onExited?.();
      }, effectiveDuration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [inProp, effectiveDuration]);

  const isIn = state === 'entered' || state === 'entering';

  return {
    state,
    isIn,
    isIdle: state === 'idle',
    isEntering: state === 'entering',
    isEntered: state === 'entered',
    isExiting: state === 'exiting',
    isExited: state === 'exited',
  };
}

export function useAnimatedHeight(
  isVisible: boolean,
  options: { duration?: number; minHeight?: number } = {}
) {
  const { duration = 300, minHeight = 0 } = options;
  const [height, setHeight] = useState<number | 'auto'>(
    isVisible ? 'auto' : minHeight
  );
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setHeight(isVisible ? 'auto' : minHeight);
      return;
    }

    if (isVisible) {
      setHeight('auto');
    } else {
      const computedHeight = document.body.scrollHeight;
      setHeight(computedHeight);

      requestAnimationFrame(() => {
        setHeight(minHeight);
      });
    }
  }, [isVisible, minHeight]);

  return {
    height,
    isAnimating: false,
  };
}

export function useFadeTransition(isVisible: boolean, duration = 300) {
  const prefersReducedMotion = useReducedMotion();
  const [opacity, setOpacity] = useState(isVisible ? 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setOpacity(isVisible ? 1 : 0);
      return;
    }

    setOpacity(isVisible ? 1 : 0);
  }, [isVisible, prefersReducedMotion]);

  return {
    opacity,
    transition: `opacity ${duration}ms ease-in-out`,
  };
}

export function useScaleTransition(isVisible: boolean, duration = 300) {
  const prefersReducedMotion = useReducedMotion();
  const [scale, setScale] = useState(isVisible ? 1 : 0.95);
  const [opacity, setOpacity] = useState(isVisible ? 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setScale(1);
      setOpacity(1);
      return;
    }

    setScale(isVisible ? 1 : 0.95);
    setOpacity(isVisible ? 1 : 0);
  }, [isVisible, prefersReducedMotion]);

  return {
    scale,
    opacity,
    transition: `transform ${duration}ms ease-out, opacity ${duration}ms ease-in`,
  };
}

export function useSlideTransition(
  direction: 'left' | 'right' | 'up' | 'down',
  isVisible: boolean,
  duration = 300
) {
  const prefersReducedMotion = useReducedMotion();
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const getInitialOffset = () => {
    switch (direction) {
      case 'left':
        return { x: -20, y: 0 };
      case 'right':
        return { x: 20, y: 0 };
      case 'up':
        return { x: 0, y: -20 };
      case 'down':
        return { x: 0, y: 20 };
    }
  };

  useEffect(() => {
    if (prefersReducedMotion) {
      setTranslate({ x: 0, y: 0 });
      return;
    }

    setTranslate(isVisible ? { x: 0, y: 0 } : getInitialOffset());
  }, [isVisible, direction, prefersReducedMotion]);

  return {
    translateX: translate.x,
    translateY: translate.y,
    transition: `transform ${duration}ms ease-out`,
  };
}
