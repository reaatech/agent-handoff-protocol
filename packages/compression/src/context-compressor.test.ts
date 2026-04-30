import { describe, expect, it } from 'vitest';
import { SimpleTokenCounter } from './context-compressor.js';

describe('SimpleTokenCounter', () => {
  const counter = new SimpleTokenCounter();

  it('estimates zero for empty string', () => {
    expect(counter.estimate('')).toBe(0);
  });

  it('estimates ASCII text', () => {
    // 40 chars * 0.25 = 10 tokens
    expect(counter.estimate('a'.repeat(40))).toBe(10);
  });

  it('estimates CJK text higher', () => {
    // 8 CJK chars * 0.67 = 5.36 -> 6 tokens
    expect(counter.estimate('你好世界你好世界')).toBe(6);
  });

  it('estimates mixed text', () => {
    const text = 'Hello world! 你好世界'; // 12 ASCII + 4 CJK
    // 12 * 0.25 + 4 * 0.67 = 3 + 2.68 = 5.68 -> 6
    expect(counter.estimate(text)).toBe(6);
  });

  it('handles unicode edge cases', () => {
    expect(counter.estimate('🎉')).toBe(1);
    expect(counter.estimate('é')).toBe(1);
  });
});
