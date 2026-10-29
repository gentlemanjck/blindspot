// Tiny DOM helpers; the app has no UI framework (SPEC §9).

type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [event, handler] of Object.entries(props.on ?? {})) {
    if (handler) el.addEventListener(event, handler);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/** A mounted screen. `destroy` removes listeners and timers. */
export interface Screen {
  el: HTMLElement;
  destroy?: () => void;
}

/** Reads the width of one exercise character from the design tokens. */
export function cellPx(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--type-cell'));
  return Number.isFinite(v) && v > 0 ? v : 30;
}

const VISIBLE: Record<string, string> = { ' ': 'пробел' };

/** Human-readable name of a character for messages. */
export function charName(ch: string): string {
  return VISIBLE[ch] ?? ch;
}
