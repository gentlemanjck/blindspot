import { describe, expect, it } from 'vitest';
import { charsMatch, classifyKey } from '../../src/engine/index.ts';

describe('classifyKey', () => {
  it('treats Cyrillic letters, digits, punctuation and space as characters', () => {
    for (const key of ['а', 'Ё', '7', '.', '"', ' '])
      expect(classifyKey({ key }), key).toBe('char');
  });

  it('ignores modifiers, navigation and shortcuts', () => {
    for (const key of [
      'Shift',
      'Alt',
      'Meta',
      'Control',
      'CapsLock',
      'Tab',
      'Escape',
      'ArrowLeft',
      'Enter',
      'Dead',
    ]) {
      expect(classifyKey({ key }), key).toBe('ignore');
    }
    expect(classifyKey({ key: 'а', metaKey: true })).toBe('ignore');
    expect(classifyKey({ key: 'а', ctrlKey: true })).toBe('ignore');
  });

  it('recognises Backspace', () => {
    expect(classifyKey({ key: 'Backspace' })).toBe('backspace');
  });

  it('flags Latin letters as a wrong layout', () => {
    expect(classifyKey({ key: 'f' })).toBe('wrongLayout');
    expect(classifyKey({ key: 'J' })).toBe('wrongLayout');
  });
});

describe('charsMatch', () => {
  it('compares characters exactly by default', () => {
    expect(charsMatch('а', 'а', false)).toBe(true);
    expect(charsMatch('ё', 'е', false)).toBe(false);
  });

  it('accepts е for ё and back when ё is optional, keeping case', () => {
    expect(charsMatch('ё', 'е', true)).toBe(true);
    expect(charsMatch('е', 'ё', true)).toBe(true);
    expect(charsMatch('Ё', 'Е', true)).toBe(true);
    expect(charsMatch('Ё', 'е', true)).toBe(false);
  });
});
