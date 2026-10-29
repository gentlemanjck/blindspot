// Keystroke classification and character comparison (SPEC §6). No DOM: callers pass the
// relevant fields of a KeyboardEvent.

export interface RawKey {
  /** KeyboardEvent.key */
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

/**
 * - `char` — produces a character to compare with the text
 * - `backspace` — correction (flow mode only)
 * - `wrongLayout` — a Latin letter: the Russian input source is off; not counted
 * - `ignore` — modifiers, navigation, dead keys and shortcuts with Cmd/Ctrl
 */
export type KeyKind = 'char' | 'backspace' | 'wrongLayout' | 'ignore';

export function classifyKey(e: RawKey): KeyKind {
  if (e.metaKey || e.ctrlKey) return 'ignore';
  if (e.key === 'Backspace') return 'backspace';
  // Named keys (Shift, Tab, ArrowLeft, Dead…) are longer than one code point.
  if ([...e.key].length !== 1) return 'ignore';
  if (/^[a-z]$/i.test(e.key)) return 'wrongLayout';
  return 'char';
}

const YO: Record<string, string> = { ё: 'е', Ё: 'Е' };

/** Whether `typed` satisfies `expected`; with `yoOptional`, е and ё are interchangeable. */
export function charsMatch(expected: string, typed: string, yoOptional: boolean): boolean {
  if (typed === expected) return true;
  if (!yoOptional) return false;
  return (YO[expected] ?? expected) === (YO[typed] ?? typed);
}
