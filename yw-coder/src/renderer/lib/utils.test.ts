import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('cn (className merge)', () => {
  it('should merge two class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle falsy values', () => {
    expect(cn('foo', false && 'bar', null, 'baz')).toBe('foo baz');
  });

  it('should handle empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('should merge tailwind classes with same utility', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });
});
