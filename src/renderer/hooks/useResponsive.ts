/**
 * 响应式 Hook
 * 提供响应式布局支持
 */

import { useState, useEffect, useCallback } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface BreakpointValues<T> {
  xs?: T;
  sm?: T;
  md?: T;
  responsive?: T;
}

const breakpointSizes: Record<Breakpoint, number> = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('lg');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;

      if (width < breakpointSizes.sm) {
        setBreakpoint('xs');
      } else if (width < breakpointSizes.md) {
        setBreakpoint('sm');
      } else if (width < breakpointSizes.lg) {
        setBreakpoint('md');
      } else if (width < breakpointSizes.xl) {
        setBreakpoint('lg');
      } else if (width < breakpointSizes['2xl']) {
        setBreakpoint('xl');
      } else {
        setBreakpoint('2xl');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  }, []);

  return breakpoint;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

export function useIsReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  return size;
}

export function useResponsiveValue<T>(values: BreakpointValues<T>): T | undefined {
  const breakpoint = useBreakpoint();

  const getValue = useCallback((): T | undefined => {
    if (values[breakpoint]) {
      return values[breakpoint];
    }

    const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];

    for (const bp of breakpointOrder) {
      if (values[bp as Breakpoint]) {
        return values[bp as Breakpoint];
      }
    }

    return values.responsive;
  }, [breakpoint, values]);

  return getValue();
}

export function useResponsiveLayout() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  const windowSize = useWindowSize();
  const breakpoint = useBreakpoint();

  const getLayout = useCallback(
    <T>(layouts: {
      mobile: T;
      tablet?: T;
      desktop?: T;
    }): T => {
      if (isMobile || breakpoint === 'xs' || breakpoint === 'sm') {
        return layouts.mobile;
      }
      if (isTablet || breakpoint === 'md' || breakpoint === 'lg') {
        return layouts.tablet || layouts.mobile;
      }
      return layouts.desktop || layouts.tablet || layouts.mobile;
    },
    [isMobile, isTablet, isDesktop, breakpoint]
  );

  return {
    isMobile,
    isTablet,
    isDesktop,
    windowSize,
    breakpoint,
    getLayout,
  };
}

export function useScrollLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [enabled]);
}

export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      setInsets({
        top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10),
        right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0', 10),
        bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0', 10),
        left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0', 10),
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
    };
  }, []);

  return insets;
}
