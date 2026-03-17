import { describe, it, expect } from 'vitest';

describe('Basic Tests', () => {
  it('should pass basic math', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const str = 'hello world';
    expect(str.length).toBe(11);
    expect(str.toUpperCase()).toBe('HELLO WORLD');
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr.length).toBe(5);
    expect(arr.filter(x => x > 2)).toEqual([3, 4, 5]);
  });

  it('should handle objects', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBeGreaterThan(40);
  });
});
