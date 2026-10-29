import { describe, expect, it } from 'vitest';
import { TypingSession, type SessionOptions } from '../../src/engine/index.ts';

/** Feeds [key, at] pairs and returns the session. */
function play(options: SessionOptions, keys: [string, number][]): TypingSession {
  const s = new TypingSession(options);
  for (const [key, at] of keys) s.input({ key }, at);
  return s;
}

describe('TypingSession — stop mode (lessons)', () => {
  it('does not advance on a wrong key and counts every wrong press', () => {
    const s = play({ text: 'ао', mode: 'stop' }, [
      ['а', 0],
      ['в', 100],
      ['в', 200],
      ['л', 300],
    ]);
    expect(s.cursor).toBe(1);
    expect(s.stats(300).errors).toBe(3);
    expect(s.errorPositions.has(1)).toBe(true);
  });

  it('finishes after the last correct character', () => {
    const s = play({ text: 'ао', mode: 'stop' }, [
      ['а', 0],
      ['о', 500],
    ]);
    expect(s.status).toBe('finished');
    expect(s.input({ key: 'а' }, 600)).toBe('ignored');
  });

  it('ignores Backspace', () => {
    const s = play({ text: 'ао', mode: 'stop' }, [
      ['а', 0],
      ['Backspace', 100],
    ]);
    expect(s.cursor).toBe(1);
  });

  it('matches the hand-calculated example', () => {
    // Text "ао ао", 7 keystrokes, 5 correct, last at 3000 ms.
    const s = play({ text: 'ао ао', mode: 'stop' }, [
      ['а', 0],
      ['о', 1000],
      ['в', 1500],
      [' ', 2000],
      ['а', 2500],
      ['л', 2800],
      ['о', 3000],
    ]);
    const st = s.stats();
    expect(st.elapsedMs).toBe(3000);
    expect(st.correctChars).toBe(5);
    expect(st.typedChars).toBe(7);
    expect(st.errors).toBe(2);
    expect(st.cpm).toBe(100); // 5 / 0.05 min
    expect(st.rawCpm).toBe(140); // 7 / 0.05 min
    expect(st.wpm).toBe(20);
    expect(st.accuracy).toBeCloseTo((5 / 7) * 100, 10);
    expect(st.perKey.get('а')).toEqual({ hits: 2, misses: 0, totalMs: 500, timedHits: 1 });
    expect(st.perKey.get('о')).toEqual({ hits: 2, misses: 1, totalMs: 1200, timedHits: 2 });
    expect(st.perKey.get(' ')).toEqual({ hits: 1, misses: 1, totalMs: 500, timedHits: 1 });
  });
});

describe('TypingSession — flow mode (speed test)', () => {
  it('moves on after a wrong character and scores final positions', () => {
    const s = play({ text: 'ао ла', mode: 'flow' }, [
      ['а', 0],
      ['в', 400],
      [' ', 800],
      ['л', 1200],
      ['а', 1600],
    ]);
    expect(s.status).toBe('finished');
    expect(s.typedAt(1)).toBe('в');
    expect(s.correctAt(0)).toBe(true);
    expect(s.correctAt(1)).toBe(false);
    const st = s.stats();
    expect(st.correctChars).toBe(4);
    expect(st.typedChars).toBe(5);
    expect(st.accuracy).toBe(80);
    expect(st.cpm).toBe(150); // 4 / (1600 / 60000)
    expect(st.rawCpm).toBe(187.5);
  });

  it('lets Backspace fix the current word but not a completed one', () => {
    const s = play({ text: 'ао ла', mode: 'flow' }, [
      ['а', 0],
      ['в', 100],
      ['Backspace', 200],
      ['о', 300],
      [' ', 400],
    ]);
    expect(s.cursor).toBe(3);
    expect(s.input({ key: 'Backspace' }, 500)).toBe('ignored');
    expect(s.cursor).toBe(3);
    const st = s.stats(500);
    expect(st.correctChars).toBe(3);
    expect(st.accuracy).toBe(75); // corrected error still counts
  });

  it('accepts е for ё when ё is optional', () => {
    const s = play({ text: 'ёж', mode: 'flow', yoOptional: true }, [
      ['е', 0],
      ['ж', 100],
    ]);
    expect(s.stats().accuracy).toBe(100);
  });

  it('extends the text with append', () => {
    const s = new TypingSession({ text: 'а', mode: 'flow' });
    s.append(' о');
    s.input({ key: 'а' }, 0);
    expect(s.status).toBe('running');
    expect(s.text).toBe('а о');
  });
});

describe('TypingSession — timer', () => {
  it('starts on the first keystroke, not on creation', () => {
    const s = new TypingSession({ text: 'ао', mode: 'stop' });
    expect(s.status).toBe('idle');
    s.input({ key: 'а' }, 10_000);
    expect(s.status).toBe('running');
    expect(s.stats(10_600).elapsedMs).toBe(600);
  });

  it('excludes paused time from elapsed time and key timings', () => {
    const s = new TypingSession({ text: 'аоа', mode: 'stop' });
    s.input({ key: 'а' }, 0);
    s.pause(1000);
    expect(s.status).toBe('paused');
    s.resume(5000);
    s.input({ key: 'о' }, 5500);
    expect(s.stats(5500).elapsedMs).toBe(1500);
    expect(s.stats(5500).perKey.get('о')?.totalMs).toBe(1500);
  });

  it('resumes automatically on a keystroke while paused', () => {
    const s = new TypingSession({ text: 'аоа', mode: 'stop' });
    s.input({ key: 'а' }, 0);
    s.pause(1000);
    s.input({ key: 'о' }, 3000);
    expect(s.status).toBe('running');
    expect(s.stats(3000).elapsedMs).toBe(1000);
  });

  it('finishes at the time limit and ignores later keys', () => {
    const s = new TypingSession({ text: 'аоаоаоао', mode: 'flow', timeLimitMs: 1000 });
    s.input({ key: 'а' }, 0);
    s.input({ key: 'о' }, 500);
    expect(s.tick(999)).toBe(false);
    expect(s.tick(1200)).toBe(true);
    expect(s.status).toBe('finished');
    expect(s.input({ key: 'а' }, 1300)).toBe('ignored');
    expect(s.stats(5000).elapsedMs).toBe(1000);
  });

  it('drops a keystroke that arrives after the limit', () => {
    const s = new TypingSession({ text: 'аоаоаоао', mode: 'flow', timeLimitMs: 1000 });
    s.input({ key: 'а' }, 0);
    expect(s.input({ key: 'о' }, 1500)).toBe('ignored');
    expect(s.status).toBe('finished');
    expect(s.stats().typedChars).toBe(1);
  });
});

describe('TypingSession — non-character keys', () => {
  it('reports Latin input without counting it or starting the timer', () => {
    const s = new TypingSession({ text: 'ао', mode: 'stop' });
    expect(s.input({ key: 'f' }, 0)).toBe('wrongLayout');
    expect(s.status).toBe('idle');
    expect(s.stats(0).typedChars).toBe(0);
  });

  it('ignores modifiers and shortcuts', () => {
    const s = new TypingSession({ text: 'ао', mode: 'stop' });
    expect(s.input({ key: 'Shift' }, 0)).toBe('ignored');
    expect(s.input({ key: 'а', metaKey: true }, 0)).toBe('ignored');
    expect(s.status).toBe('idle');
  });

  it('returns correct or error for character keys', () => {
    const s = new TypingSession({ text: 'ао', mode: 'stop' });
    expect(s.input({ key: 'а' }, 0)).toBe('correct');
    expect(s.input({ key: 'в' }, 100)).toBe('error');
  });
});
