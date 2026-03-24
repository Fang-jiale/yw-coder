/**
 * 可访问性工具
 * 提供 ARIA 标签、键盘导航等功能
 */

import { useCallback, useEffect, useRef } from 'react';

export interface AriaLabel {
  role?: string;
  label: string;
  describedBy?: string;
  labelledBy?: string;
}

export interface FocusTrapOptions {
  enabled?: boolean;
  onEscape?: () => void;
}

export function useAccessibility() {
  const generateId = useCallback((prefix: string = 'aria') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  const trapFocus = useCallback((containerRef: React.RefObject<HTMLElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleEscape = useCallback((callback: () => void) => {
    return (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback();
      }
    };
  }, []);

  const setupRovingTabIndex = useCallback(
    (
      containerRef: React.RefObject<HTMLElement>,
      selector: string = '[role="tab"], [role="menuitem"], [role="option"]'
    ) => {
      const container = containerRef.current;
      if (!container) return;

      const items = Array.from(container.querySelectorAll(selector)) as HTMLElement[];

      items.forEach((item, index) => {
        item.setAttribute('tabindex', index === 0 ? '0' : '-1');

        item.addEventListener('keydown', (e: KeyboardEvent) => {
          const currentIndex = items.indexOf(item as HTMLElement);

          switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
              e.preventDefault();
              const nextIndex = (currentIndex + 1) % items.length;
              items[nextIndex]?.focus();
              break;

            case 'ArrowUp':
            case 'ArrowLeft':
              e.preventDefault();
              const prevIndex = (currentIndex - 1 + items.length) % items.length;
              items[prevIndex]?.focus();
              break;

            case 'Home':
              e.preventDefault();
              items[0]?.focus();
              break;

            case 'End':
              e.preventDefault();
              items[items.length - 1]?.focus();
              break;
          }
        });
      });
    },
    []
  );

  return {
    generateId,
    announceToScreenReader,
    trapFocus,
    handleEscape,
    setupRovingTabIndex,
  };
}

export function useFocusManagement() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    const previousFocus = previousFocusRef.current;
    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  }, []);

  const focusFirst = useCallback((containerRef: React.RefObject<HTMLElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const focusable = container.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;

    focusable?.focus();
  }, []);

  return {
    restoreFocus,
    focusFirst,
  };
}

export function useAnnounceOnChange(dependencies: unknown[]) {
  const previousValueRef = useRef<unknown>();
  const { announceToScreenReader } = useAccessibility();

  useEffect(() => {
    if (previousValueRef.current !== undefined) {
      announceToScreenReader('内容已更新');
    }
    previousValueRef.current = dependencies[0];
  }, dependencies);
}

export const accessibilityHelpers = {
  getAriaLabel(props: AriaLabel): Record<string, string> {
    const result: Record<string, string> = {};

    if (props.role) {
      result.role = props.role;
    }

    if (props.label) {
      result['aria-label'] = props.label;
    }

    if (props.describedBy) {
      result['aria-describedby'] = props.describedBy;
    }

    if (props.labelledBy) {
      result['aria-labelledby'] = props.labelledBy;
    }

    return result;
  },

  isFocusable(element: HTMLElement): boolean {
    if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1') {
      return true;
    }

    const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    return focusableTags.includes(element.tagName);
  },

  getFirstFocusable(container: HTMLElement): HTMLElement | null {
    return (
      container.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement
    );
  },

  getLastFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    return (focusable[focusable.length - 1] as HTMLElement) || null;
  },

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },
};

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcut(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modifiers = shortcut.modifiers || [];
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = modifiers.includes('ctrl') === (e.ctrlKey || e.metaKey);
        const shiftMatches = modifiers.includes('shift') === e.shiftKey;
        const altMatches = modifiers.includes('alt') === e.altKey;
        const metaMatches = modifiers.includes('meta') === e.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
