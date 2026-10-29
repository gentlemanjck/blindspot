// Speed and accuracy figures (SPEC §6), computed from the keystroke log.

export interface Keystroke {
  /** Position in the text. */
  index: number;
  expected: string;
  typed: string;
  correct: boolean;
  /** Active (pause-free) time since the first keystroke, ms. */
  activeAt: number;
  /** Active time since the previous character keystroke; null for the first one. */
  sincePrevMs: number | null;
}

export interface KeyStat {
  hits: number;
  misses: number;
  /** Sum of `sincePrevMs` over timed hits; mean time = totalMs / timedHits. */
  totalMs: number;
  timedHits: number;
}

export interface Stats {
  elapsedMs: number;
  /** Characters that ended up correct in the text. */
  correctChars: number;
  /** All character keystrokes, including wrong ones. */
  typedChars: number;
  errors: number;
  cpm: number;
  rawCpm: number;
  wpm: number;
  /** 0–100. 100 when nothing has been typed. */
  accuracy: number;
  /** Keyed by the expected character. */
  perKey: Map<string, KeyStat>;
}

/** Characters per minute. */
export function cpm(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (chars / elapsedMs) * 60_000;
}

export function computeStats(
  log: readonly Keystroke[],
  correctChars: number,
  elapsedMs: number,
): Stats {
  const perKey = new Map<string, KeyStat>();
  let correctKeystrokes = 0;
  for (const k of log) {
    let stat = perKey.get(k.expected);
    if (!stat) {
      stat = { hits: 0, misses: 0, totalMs: 0, timedHits: 0 };
      perKey.set(k.expected, stat);
    }
    if (k.correct) {
      correctKeystrokes++;
      stat.hits++;
      if (k.sincePrevMs !== null) {
        stat.totalMs += k.sincePrevMs;
        stat.timedHits++;
      }
    } else {
      stat.misses++;
    }
  }
  const speed = cpm(correctChars, elapsedMs);
  return {
    elapsedMs,
    correctChars,
    typedChars: log.length,
    errors: log.length - correctKeystrokes,
    cpm: speed,
    rawCpm: cpm(log.length, elapsedMs),
    wpm: speed / 5,
    accuracy: log.length === 0 ? 100 : (correctKeystrokes / log.length) * 100,
    perKey,
  };
}

/** The n keys with the most misses; ties go to the slower mean time. */
export function worstKeys(perKey: ReadonlyMap<string, KeyStat>, n: number): string[] {
  const mean = (s: KeyStat) => (s.timedHits ? s.totalMs / s.timedHits : 0);
  return [...perKey]
    .sort((a, b) => b[1].misses - a[1].misses || mean(b[1]) - mean(a[1]))
    .slice(0, n)
    .map(([ch]) => ch);
}
