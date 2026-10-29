// The exercise text, one character per notebook square, wrapped at spaces (SPEC §7).

import type { TypingSession } from '../engine/index.ts';
import { cellPx, h } from './dom.ts';

export class TextLine {
  readonly el: HTMLDivElement;
  private cells: HTMLSpanElement[] = [];
  private text = '';
  private session: TypingSession | undefined;
  private cols = 0;
  private readonly resize: ResizeObserver;

  constructor() {
    this.el = h('div', { class: 'text-line', attrs: { 'data-testid': 'text-line' } });
    this.resize = new ResizeObserver(() => {
      if (this.columns() !== this.cols) this.layout();
    });
    this.resize.observe(this.el);
  }

  setSession(session: TypingSession): void {
    this.session = session;
    this.text = session.text;
    this.el.dataset['text'] = this.text;
    this.layout();
  }

  /** Re-applies every cell state; cheap enough (≤ 60 cells) to do on each keystroke. */
  update(): void {
    const s = this.session;
    if (!s) return;
    const cursor = s.cursor;
    const finished = s.status === 'finished';
    this.cells.forEach((cell, i) => {
      let state = i < cursor ? 'done' : 'todo';
      if (i === cursor && !finished) state = 'cur';
      cell.className = `cell ${state}${s.errorPositions.has(i) ? ' err' : ''}${
        this.text[i] === ' ' ? ' space' : ''
      }`;
    });
  }

  destroy(): void {
    this.resize.disconnect();
  }

  private columns(): number {
    return Math.max(10, Math.floor(this.el.clientWidth / cellPx()));
  }

  /** Greedy wrap at spaces; a space stays at the end of its row so it is still typed. */
  private layout(): void {
    this.cols = this.columns();
    const rows: string[] = [];
    let row = '';
    for (const word of this.text.split(/(?<= )/)) {
      if (row && row.length + word.trimEnd().length > this.cols) {
        rows.push(row);
        row = '';
      }
      row += word;
    }
    if (row) rows.push(row);

    this.cells = [];
    this.el.replaceChildren(
      ...rows.map((r) =>
        h(
          'div',
          { class: 'row' },
          ...[...r].map((ch) => {
            const cell = h('span', { class: 'cell', text: ch === ' ' ? '' : ch });
            this.cells.push(cell);
            return cell;
          }),
        ),
      ),
    );
    this.update();
  }
}
