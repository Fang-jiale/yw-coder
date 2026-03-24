import { useState, useEffect } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
} as const;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.tablet) {
        setBreakpoint('mobile');
      } else if (width < BREAKPOINTS.desktop) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    updateBreakpoint();

    const resizeObserver = new ResizeObserver(() => {
      updateBreakpoint();
    });

    resizeObserver.observe(document.documentElement);

    return () => resizeObserver.disconnect();
  }, []);

  return breakpoint;
}

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.tablet - 1}px)`);
}

export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);
}

export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return size;
}
