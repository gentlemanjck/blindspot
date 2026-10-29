// One typing session for both modes (SPEC §6). Time is always passed in by the caller,
// so the session is deterministic and never reads a clock.

import { charsMatch, classifyKey, type RawKey } from './keys.ts';
import { computeStats, type Keystroke, type Stats } from './metrics.ts';

/** `stop` — lessons: wait for the right key. `flow` — speed test: move on after errors. */
export type Mode = 'stop' | 'flow';

export interface SessionOptions {
  text: string;
  mode: Mode;
  /** Accept е for ё and back (speed test option). */
  yoOptional?: boolean;
  /** End the session after this much active time (timed speed test). */
  timeLimitMs?: number;
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished';

export type InputResult = 'correct' | 'error' | 'backspace' | 'wrongLayout' | 'ignored';

export class TypingSession {
  readonly mode: Mode;
  private readonly yoOptional: boolean;
  private readonly timeLimitMs: number | undefined;

  private _text: string;
  private _cursor = 0;
  /** What was typed at each position before the cursor (flow mode can hold errors). */
  private readonly typed: string[] = [];
  /** Backspace cannot move the cursor below this (start of the current word). */
  private wordStart = 0;
  private readonly _errorPositions = new Set<number>();
  private readonly log: Keystroke[] = [];

  private _status: SessionStatus = 'idle';
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;
  private finishedActive = 0;

  constructor(options: SessionOptions) {
    this._text = options.text;
    this.mode = options.mode;
    this.yoOptional = options.yoOptional ?? false;
    this.timeLimitMs = options.timeLimitMs;
  }

  get text(): string {
    return this._text;
  }

  get cursor(): number {
    return this._cursor;
  }

  get status(): SessionStatus {
    return this._status;
  }

  /** Positions where at least one wrong key was pressed. */
  get errorPositions(): ReadonlySet<number> {
    return this._errorPositions;
  }

  /** Character typed at a position before the cursor, or undefined. */
  typedAt(index: number): string | undefined {
    return index < this._cursor ? this.typed[index] : undefined;
  }

  /** Whether the character typed at a position matches the text; undefined if not typed yet. */
  correctAt(index: number): boolean | undefined {
    const typed = this.typedAt(index);
    const expected = this._text[index];
    if (typed === undefined || expected === undefined) return undefined;
    return charsMatch(expected, typed, this.yoOptional);
  }

  /** Adds text to the end, for timed tests that generate words as they go. */
  append(more: string): void {
    this._text += more;
  }

  input(key: RawKey, at: number): InputResult {
    if (this._status === 'finished') return 'ignored';
    const kind = classifyKey(key);
    if (kind === 'ignore') return 'ignored';
    if (kind === 'wrongLayout') return 'wrongLayout';

    if (this._status === 'paused') this.resume(at);
    if (this.tick(at)) return 'ignored';

    if (kind === 'backspace') return this.backspace();

    if (this._status === 'idle') {
      this._status = 'running';
      this.startedAt = at;
    }
    return this.typeChar(key.key, this.activeTime(at));
  }

  pause(at: number): void {
    if (this._status !== 'running') return;
    this._status = 'paused';
    this.pausedAt = at;
  }

  resume(at: number): void {
    if (this._status !== 'paused') return;
    this.pausedTotal += at - this.pausedAt;
    this._status = 'running';
  }

  /** Ends the session if the time limit has passed. Returns true when finished. */
  tick(now: number): boolean {
    if (this._status === 'finished') return true;
    if (this.timeLimitMs === undefined || this._status === 'idle') return false;
    if (this.activeTime(now) < this.timeLimitMs) return false;
    this.finish(this.timeLimitMs);
    return true;
  }

  /**
   * Figures so far. After the session ends they are final; while running, pass `now` to
   * include the time since the last keystroke (otherwise it counts up to the last keystroke).
   */
  stats(now?: number): Stats {
    let elapsed: number;
    if (this._status === 'finished') elapsed = this.finishedActive;
    else if (this._status === 'idle') elapsed = 0;
    else if (now !== undefined) elapsed = this.activeTime(now);
    else elapsed = this.log.at(-1)?.activeAt ?? 0;
    return computeStats(this.log, this.correctChars(), elapsed);
  }

  private typeChar(char: string, activeAt: number): InputResult {
    const index = this._cursor;
    const expected = this._text[index];
    if (expected === undefined) return 'ignored';
    const correct = charsMatch(expected, char, this.yoOptional);
    const prev = this.log.at(-1);
    this.log.push({
      index,
      expected,
      typed: char,
      correct,
      activeAt,
      sincePrevMs: prev ? activeAt - prev.activeAt : null,
    });
    if (!correct) this._errorPositions.add(index);

    if (correct || this.mode === 'flow') {
      this.typed[index] = char;
      this._cursor++;
      if (expected === ' ') this.wordStart = this._cursor;
      if (this._cursor === this._text.length) this.finish(activeAt);
    }
    return correct ? 'correct' : 'error';
  }

  private backspace(): InputResult {
    if (this.mode === 'stop' || this._cursor <= this.wordStart) return 'ignored';
    this._cursor--;
    this.typed.length = this._cursor;
    return 'backspace';
  }

  private correctChars(): number {
    if (this.mode === 'stop') return this._cursor;
    let n = 0;
    for (let i = 0; i < this._cursor; i++) {
      const expected = this._text[i];
      const typed = this.typed[i];
      if (
        expected !== undefined &&
        typed !== undefined &&
        charsMatch(expected, typed, this.yoOptional)
      )
        n++;
    }
    return n;
  }

  private activeTime(now: number): number {
    const pausedNow = this._status === 'paused' ? now - this.pausedAt : 0;
    return now - this.startedAt - this.pausedTotal - pausedNow;
  }

  private finish(activeMs: number): void {
    this._status = 'finished';
    this.finishedActive = activeMs;
  }
}
