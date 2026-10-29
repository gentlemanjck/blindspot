import { describe, expect, it } from 'vitest';
import { cpm } from '../src/engine/index.ts';

describe('cpm', () => {
  it('counts characters per minute', () => {
    expect(cpm(150, 30_000)).toBe(300);
  });

  it('returns 0 before any time has passed', () => {
    expect(cpm(5, 0)).toBe(0);
  });
});
