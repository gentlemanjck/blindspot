// The exercise text in fixed-width cells, wrapped at spaces (SPEC §7). With `maxRows` only a
// window of rows around the cursor is shown, scrolling by whole rows.

import type { TypingSession } from '../engine/index.ts';
import { cellPx, h } from './dom.ts';

interface Row {
  el: HTMLDivElement;
  /** Index of the row's first character in the text. */
  start: number;
  cells: HTMLSpanElement[];
}

export class TextLine {
  readonly el: HTMLDivElement;
  private rows: Row[] = [];
  private text = '';
  private session: TypingSession | undefined;
  private cols = 0;
  private readonly maxRows: number;
  private readonly resize: ResizeObserver;

  constructor(maxRows = Infinity) {
    this.maxRows = maxRows;
    this.el = h('div', { class: 'text-line', attrs: { 'data-testid': 'text-line' } });
    this.resize = new ResizeObserver(() => {
      if (this.columns() !== this.cols) this.layout();
    });
    this.resize.observe(this.el);
  }

  setSession(session: TypingSession): void {
    this.session = session;
    this.refresh();
  }

  /** Re-lays out if the session text grew (timed test appends words). */
  refresh(): void {
    if (!this.session) return;
    this.text = this.session.text;
    this.el.dataset['text'] = this.text;
    this.layout();
  }

  /** Re-applies the state of every visible cell; cheap enough to do on each keystroke. */
  update(): void {
    const s = this.session;
    if (!s) return;
    const cursor = s.cursor;
    const finished = s.status === 'finished';
    const flow = s.mode === 'flow';

    let curRow = this.rows.findIndex((_, i) => cursor < (this.rows[i + 1]?.start ?? Infinity));
    if (curRow < 0) curRow = this.rows.length - 1;
    // Keep the current row second from the top once there is history above it.
    const first = Math.max(0, Math.min(curRow - 1, this.rows.length - this.maxRows));
    const last = first + this.maxRows;

    this.rows.forEach((row, r) => {
      const visible = r >= first && r < last;
      row.el.hidden = !visible;
      if (!visible) return;
      row.cells.forEach((cell, j) => {
        const i = row.start + j;
        let state = i < cursor ? 'done' : 'todo';
        if (i === cursor && !finished) state = 'cur';
        // Lessons keep every missed position red; the test shows what is wrong right now.
        const err = flow ? i < cursor && s.correctAt(i) === false : s.errorPositions.has(i);
        cell.className = `cell ${state}${err ? ' err' : ''}${this.text[i] === ' ' ? ' space' : ''}`;
      });
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
    const lines: string[] = [];
    let line = '';
    for (const word of this.text.split(/(?<= )/)) {
      if (line && line.length + word.trimEnd().length > this.cols) {
        lines.push(line);
        line = '';
      }
      line += word;
    }
    if (line) lines.push(line);

    let start = 0;
    this.rows = lines.map((l) => {
      const cells = [...l].map((ch) => h('span', { class: 'cell', text: ch === ' ' ? '' : ch }));
      const row = { el: h('div', { class: 'row' }, ...cells), start, cells };
      start += l.length;
      return row;
    });
    this.el.replaceChildren(...this.rows.map((r) => r.el));
    this.update();
  }
}
