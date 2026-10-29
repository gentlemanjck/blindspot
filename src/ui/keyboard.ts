// On-screen keyboard rendered from the layout data (SPEC §3, §7): finger zones, the next key,
// the Shift to use, and a short flash on each press.

import {
  locate,
  MODIFIERS,
  ROWS,
  shiftFor,
  type Finger,
  type KeyDef,
} from '../layouts/ru-mac-iso.ts';
import { h } from './dom.ts';

interface Slot {
  /** Width in notebook squares; keys are two squares tall. */
  w: number;
  key?: KeyDef;
  code?: string;
  label?: string;
  finger?: Finger;
  class?: string;
}

const mod = (code: string, label: string, w: number, cls?: string): Slot => {
  const def = MODIFIERS.find((m) => m.code === code);
  return { w, code, label, ...(def ? { finger: def.finger } : {}), ...(cls ? { class: cls } : {}) };
};
const deco = (label: string, w: number, cls?: string): Slot => ({
  w,
  label,
  ...(cls ? { class: cls } : {}),
});
const keys = (row: number): Slot[] => (ROWS[row] ?? []).map((key) => ({ w: 2, key }));
const space = ROWS[4]?.[0];

// Mac ISO, 29 squares wide.
const LAYOUT: Slot[][] = [
  [...keys(0), deco('⌫', 3)],
  [deco('Tab', 3), ...keys(1), mod('Enter', 'Enter', 2, 'enter-top')],
  [deco('Caps', 3), ...keys(2), mod('Enter', '', 2, 'enter-bottom')],
  [mod('ShiftLeft', 'Shift', 2), ...keys(3), mod('ShiftRight', 'Shift', 5)],
  [
    deco('fn', 2),
    deco('⌃', 2),
    deco('⌥', 2),
    deco('⌘', 3),
    ...(space ? [{ w: 13, key: space }] : []),
    deco('⌘', 3),
    deco('⌥', 2),
    deco('◂ ▴▾ ▸', 2, 'arrows'),
  ],
];

const isLetter = (s: string) => /^[а-яё]$/.test(s);

export class Keyboard {
  readonly el: HTMLDivElement;
  private readonly byCode = new Map<string, HTMLElement[]>();
  private highlighted: HTMLElement[] = [];
  private flashTimer: number | undefined;
  private flashed: HTMLElement[] = [];

  constructor() {
    this.el = h('div', { class: 'keyboard', attrs: { 'aria-hidden': 'true' } });
    for (const row of LAYOUT) {
      const rowEl = h('div', { class: 'kb-row' });
      for (const slot of row) rowEl.append(this.renderKey(slot));
      this.el.append(rowEl);
    }
  }

  /** Marks the key (and Shift) for the next expected character. */
  highlight(char: string | undefined): void {
    for (const el of this.highlighted) el.classList.remove('next');
    this.highlighted = [];
    if (char === undefined) return;
    const loc = locate(char);
    if (!loc) return;
    const shift = shiftFor(char);
    for (const code of shift ? [loc.key.code, shift] : [loc.key.code]) {
      for (const el of this.byCode.get(code) ?? []) {
        el.classList.add('next');
        this.highlighted.push(el);
      }
    }
  }

  /** Brief green/red flash on the key that produced `char` (or the physical `code`). */
  flash(char: string, code: string, ok: boolean): void {
    for (const el of this.flashed) el.classList.remove('hit', 'miss');
    window.clearTimeout(this.flashTimer);
    this.flashed = this.byCode.get(locate(char)?.key.code ?? code) ?? [];
    for (const el of this.flashed) el.classList.add(ok ? 'hit' : 'miss');
    this.flashTimer = window.setTimeout(() => {
      for (const el of this.flashed) el.classList.remove('hit', 'miss');
    }, 160);
  }

  private renderKey(slot: Slot): HTMLElement {
    const el = h('div', { class: `key${slot.class ? ` ${slot.class}` : ''}` });
    el.style.setProperty('--w', String(slot.w));
    const finger = slot.key?.finger ?? slot.finger;
    if (finger) el.dataset['finger'] = finger;
    const code = slot.key?.code ?? slot.code;
    if (code) this.byCode.set(code, [...(this.byCode.get(code) ?? []), el]);

    const k = slot.key;
    if (!k) {
      if (slot.label) el.append(h('span', { class: 'key-label', text: slot.label }));
      if (!slot.code) el.classList.add('deco');
    } else if (k.code === 'Space') {
      el.classList.add('space-key');
    } else if (isLetter(k.normal)) {
      el.append(h('span', { class: 'key-main', text: k.shift }));
    } else {
      el.append(
        h('span', { class: 'key-shift', text: k.shift }),
        h('span', { class: 'key-main', text: k.normal }),
      );
    }
    if (k?.code === 'KeyF' || k?.code === 'KeyJ') el.classList.add('home-bump');
    return el;
  }
}
