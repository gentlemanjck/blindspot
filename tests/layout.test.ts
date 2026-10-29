import { describe, expect, it } from 'vitest';
import capture from '../src/layouts/capture/ru-mac-iso.json';
import { keyByCode, locate, ROWS, shiftFor } from '../src/layouts/ru-mac-iso.ts';

const ALPHABET = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

describe('ru-mac-iso layout', () => {
  it('contains all 33 letters in lower and upper case', () => {
    for (const ch of ALPHABET) {
      expect(locate(ch), ch).toMatchObject({ shift: false });
      expect(locate(ch.toUpperCase()), ch.toUpperCase()).toMatchObject({ shift: true });
    }
  });

  it('puts period on Shift+7 and comma on Shift+6', () => {
    expect(locate('.')).toMatchObject({ shift: true, key: { code: 'Digit7' } });
    expect(locate(',')).toMatchObject({ shift: true, key: { code: 'Digit6' } });
  });

  it('puts ё on the key left of Enter, typed with the right pinky', () => {
    expect(locate('ё')).toMatchObject({ key: { code: 'Backslash', finger: 'rightPinky', row: 2 } });
  });

  it('has the lesson punctuation', () => {
    for (const ch of '!?:;-"()') expect(locate(ch), ch).toBeDefined();
  });

  it('never produces the same character from two keys', () => {
    const seen = new Map<string, string>();
    for (const key of ROWS.flat()) {
      if (key.code === 'Space') continue;
      for (const ch of [key.normal, key.shift]) {
        expect(seen.get(ch), `${ch} on ${key.code}`).toBeUndefined();
        seen.set(ch, key.code);
      }
    }
  });

  it('has unique codes and matches the row index', () => {
    const codes = ROWS.flat().map((key) => key.code);
    expect(new Set(codes).size).toBe(codes.length);
    ROWS.forEach((row, r) => row.forEach((key) => expect(key.row, key.code).toBe(r)));
  });

  it('matches the capture from the real keyboard', () => {
    for (const c of capture.keys) {
      const key = keyByCode(c.code);
      expect(key, c.code).toBeDefined();
      expect(key?.normal).toBe(c.normal);
      expect(key?.shift).toBe(c.shift);
    }
    expect(ROWS.slice(0, 4).flat()).toHaveLength(capture.keys.length);
  });

  it('chooses the Shift on the opposite hand', () => {
    expect(shiftFor('А')).toBe('ShiftRight');
    expect(shiftFor('О')).toBe('ShiftLeft');
    expect(shiftFor('.')).toBe('ShiftLeft');
    expect(shiftFor('а')).toBeNull();
  });
});
