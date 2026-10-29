// macOS "Russian" input source on an ISO keyboard (SPEC §3).
// Filled from a real capture on the user's Mac: src/layouts/capture/ru-mac-iso.json.
// Note: on this keyboard the browser reports the top-left key as IntlBackslash and the
// extra key next to left Shift as Backquote — the reverse of what the names suggest.

export type Finger =
  | 'leftPinky'
  | 'leftRing'
  | 'leftMiddle'
  | 'leftIndex'
  | 'rightIndex'
  | 'rightMiddle'
  | 'rightRing'
  | 'rightPinky'
  | 'thumb';

/** 0 digits, 1 top, 2 home, 3 bottom, 4 space. */
export type Row = 0 | 1 | 2 | 3 | 4;

export interface KeyDef {
  /** KeyboardEvent.code */
  code: string;
  normal: string;
  shift: string;
  finger: Finger;
  row: Row;
}

export interface ModifierDef {
  code: string;
  label: string;
  finger: Finger;
  row: Row;
}

const k = (code: string, normal: string, shift: string, finger: Finger, row: Row): KeyDef => ({
  code,
  normal,
  shift,
  finger,
  row,
});

/** Character keys in physical order, left to right, top to bottom. */
export const ROWS: readonly (readonly KeyDef[])[] = [
  [
    k('IntlBackslash', '>', '<', 'leftPinky', 0),
    k('Digit1', '1', '!', 'leftPinky', 0),
    k('Digit2', '2', '"', 'leftRing', 0),
    k('Digit3', '3', '№', 'leftMiddle', 0),
    k('Digit4', '4', '%', 'leftIndex', 0),
    k('Digit5', '5', ':', 'leftIndex', 0),
    k('Digit6', '6', ',', 'rightIndex', 0),
    k('Digit7', '7', '.', 'rightIndex', 0),
    k('Digit8', '8', ';', 'rightMiddle', 0),
    k('Digit9', '9', '(', 'rightRing', 0),
    k('Digit0', '0', ')', 'rightPinky', 0),
    k('Minus', '-', '_', 'rightPinky', 0),
    k('Equal', '=', '+', 'rightPinky', 0),
  ],
  [
    k('KeyQ', 'й', 'Й', 'leftPinky', 1),
    k('KeyW', 'ц', 'Ц', 'leftRing', 1),
    k('KeyE', 'у', 'У', 'leftMiddle', 1),
    k('KeyR', 'к', 'К', 'leftIndex', 1),
    k('KeyT', 'е', 'Е', 'leftIndex', 1),
    k('KeyY', 'н', 'Н', 'rightIndex', 1),
    k('KeyU', 'г', 'Г', 'rightIndex', 1),
    k('KeyI', 'ш', 'Ш', 'rightMiddle', 1),
    k('KeyO', 'щ', 'Щ', 'rightRing', 1),
    k('KeyP', 'з', 'З', 'rightPinky', 1),
    k('BracketLeft', 'х', 'Х', 'rightPinky', 1),
    k('BracketRight', 'ъ', 'Ъ', 'rightPinky', 1),
  ],
  [
    k('KeyA', 'ф', 'Ф', 'leftPinky', 2),
    k('KeyS', 'ы', 'Ы', 'leftRing', 2),
    k('KeyD', 'в', 'В', 'leftMiddle', 2),
    k('KeyF', 'а', 'А', 'leftIndex', 2),
    k('KeyG', 'п', 'П', 'leftIndex', 2),
    k('KeyH', 'р', 'Р', 'rightIndex', 2),
    k('KeyJ', 'о', 'О', 'rightIndex', 2),
    k('KeyK', 'л', 'Л', 'rightMiddle', 2),
    k('KeyL', 'д', 'Д', 'rightRing', 2),
    k('Semicolon', 'ж', 'Ж', 'rightPinky', 2),
    k('Quote', 'э', 'Э', 'rightPinky', 2),
    k('Backslash', 'ё', 'Ё', 'rightPinky', 2),
  ],
  [
    k('Backquote', ']', '[', 'leftPinky', 3),
    k('KeyZ', 'я', 'Я', 'leftPinky', 3),
    k('KeyX', 'ч', 'Ч', 'leftRing', 3),
    k('KeyC', 'с', 'С', 'leftMiddle', 3),
    k('KeyV', 'м', 'М', 'leftIndex', 3),
    k('KeyB', 'и', 'И', 'leftIndex', 3),
    k('KeyN', 'т', 'Т', 'rightIndex', 3),
    k('KeyM', 'ь', 'Ь', 'rightIndex', 3),
    k('Comma', 'б', 'Б', 'rightMiddle', 3),
    k('Period', 'ю', 'Ю', 'rightRing', 3),
    k('Slash', '/', '?', 'rightPinky', 3),
  ],
  [k('Space', ' ', ' ', 'thumb', 4)],
];

export const MODIFIERS: readonly ModifierDef[] = [
  { code: 'ShiftLeft', label: 'Shift', finger: 'leftPinky', row: 3 },
  { code: 'ShiftRight', label: 'Shift', finger: 'rightPinky', row: 3 },
  { code: 'Enter', label: 'Enter', finger: 'rightPinky', row: 2 },
];

export interface CharLocation {
  key: KeyDef;
  shift: boolean;
}

const byChar = new Map<string, CharLocation>();
const byCode = new Map<string, KeyDef>();
for (const key of ROWS.flat()) {
  byCode.set(key.code, key);
  if (!byChar.has(key.normal)) byChar.set(key.normal, { key, shift: false });
  if (!byChar.has(key.shift)) byChar.set(key.shift, { key, shift: true });
}

/** Physical key and Shift state that produce a character, or undefined if the layout lacks it. */
export function locate(char: string): CharLocation | undefined {
  return byChar.get(char);
}

export function keyByCode(code: string): KeyDef | undefined {
  return byCode.get(code);
}

export function isLeftHand(finger: Finger): boolean {
  return finger.startsWith('left');
}

/** Shift key to use for a character: the one on the opposite hand (SPEC §3), or null. */
export function shiftFor(char: string): 'ShiftLeft' | 'ShiftRight' | null {
  const loc = locate(char);
  if (!loc?.shift) return null;
  return isLeftHand(loc.key.finger) ? 'ShiftRight' : 'ShiftLeft';
}
