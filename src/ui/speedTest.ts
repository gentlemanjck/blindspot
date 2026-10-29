// Speed test (SPEC §5): locked until the course is complete; flow mode, timed or by words.

import { isCourseComplete, remainingStages } from '../curriculum/progress.ts';
import { classifyKey, TypingSession, worstKeys } from '../engine/index.ts';
import { commit, store } from '../state.ts';
import {
  addSession,
  configKey,
  updateRecord,
  type Settings,
  type TestSettings,
} from '../storage/index.ts';
import { TestText } from '../textgen/test.ts';
import { h, type Screen } from './dom.ts';
import { Keyboard } from './keyboard.ts';
import { testResultOverlay } from './result.ts';
import { TextLine } from './textLine.ts';

const LIVE_STATS_MS = 250;
const TIME_LENGTHS = [15, 30, 60, 120];
const WORD_LENGTHS = [25, 50, 100];
/** Words to start a timed test with; more are appended as the cursor nears the end. */
const TIMED_START_WORDS = 80;
const TIMED_MORE_WORDS = 40;
const TIMED_MARGIN_CHARS = 150;

/** `?unlock=1` in the URL opens the test for development (SPEC §5). */
function devUnlocked(): boolean {
  return new URLSearchParams(location.search).get('unlock') === '1';
}

export function speedTestScreen(): Screen {
  if (!isCourseComplete(store.data.course) && !devUnlocked()) return lockedScreen();
  return mountTest();
}

function lockedScreen(): Screen {
  const remaining = remainingStages(store.data.course);
  return {
    el: h(
      'section',
      { class: 'page test-locked' },
      h('h1', { class: 'title', text: 'Тест скорости' }),
      h('p', {
        class: 'lead',
        text: `Откроется, когда вы пройдёте этапы 1–17 курса. Осталось этапов: ${remaining.length}.`,
      }),
      h(
        'ol',
        { class: 'remaining', attrs: { 'aria-label': 'Оставшиеся этапы' } },
        ...remaining.map((id) => h('li', { text: String(id) })),
      ),
      h(
        'p',
        { class: 'actions' },
        h('a', { class: 'btn primary', text: 'К курсу', attrs: { href: '#/' } }),
      ),
    ),
  };
}

function mountTest(): Screen {
  let showKeyboard = false;
  const textLine = new TextLine(3);
  const keyboard = new Keyboard();
  const counter = h('p', { class: 'test-counter', attrs: { 'aria-live': 'off' } });
  const cpmEl = h('b');
  const accEl = h('b');
  const note = h('p', { class: 'lesson-note', attrs: { role: 'status' } });
  const modebar = h('div', {
    class: 'modebar',
    attrs: { role: 'toolbar', 'aria-label': 'Режим теста' },
  });

  const el = h(
    'section',
    { class: 'page speed-test' },
    h('h1', { class: 'title', text: 'Тест скорости' }),
    modebar,
    h('div', { class: 'test-zone' }, counter, h('div', { class: 'type-zone' }, textLine.el)),
    h(
      'div',
      { class: 'live-stats' },
      h('p', { class: 'stat stat-cpm' }, cpmEl, h('span', { text: 'зн/мин' })),
      h('p', { class: 'stat stat-acc' }, accEl, h('span', { text: '%' })),
    ),
    note,
    keyboard.el,
  );

  let session: TypingSession;
  let text: TestText;
  let timer: number | undefined;
  let overlay: HTMLElement | undefined;
  let onOverlayKey: ((e: KeyboardEvent) => void) | undefined;

  const settings = (): TestSettings => store.data.settings.test;

  function saveTestSettings(patch: Partial<TestSettings>): void {
    const s: Settings = store.data.settings;
    commit({ ...store.data, settings: { ...s, test: { ...s.test, ...patch } } });
    renderModebar();
    restart();
  }

  function segment<T extends string | number | boolean>(
    label: string,
    options: { value: T; text: string }[],
    current: T,
    onPick: (v: T) => void,
  ): HTMLElement {
    return h(
      'div',
      { class: 'segment', attrs: { role: 'group', 'aria-label': label } },
      ...options.map((o) =>
        h('button', {
          class: 'seg-btn',
          text: o.text,
          attrs: { type: 'button', 'aria-pressed': String(o.value === current) },
          on: {
            click: (e) => {
              (e.currentTarget as HTMLElement).blur();
              onPick(o.value);
            },
          },
        }),
      ),
    );
  }

  function toggle(text: string, on: boolean, onFlip: () => void): HTMLElement {
    return h('button', {
      class: 'seg-btn toggle',
      text,
      attrs: { type: 'button', 'aria-pressed': String(on) },
      on: {
        click: (e) => {
          (e.currentTarget as HTMLElement).blur();
          onFlip();
        },
      },
    });
  }

  function renderModebar(): void {
    const t = settings();
    const lengths = t.lengthType === 'time' ? TIME_LENGTHS : WORD_LENGTHS;
    modebar.replaceChildren(
      segment(
        'Длина',
        [
          { value: 'time', text: 'Время' },
          { value: 'words', text: 'Слова' },
        ],
        t.lengthType,
        (v) =>
          saveTestSettings({
            lengthType: v as TestSettings['lengthType'],
            length: v === 'time' ? 30 : 50,
          }),
      ),
      segment(
        t.lengthType === 'time' ? 'Секунды' : 'Количество слов',
        lengths.map((n) => ({ value: n, text: String(n) })),
        t.length,
        (v) => saveTestSettings({ length: Number(v) }),
      ),
      segment(
        'Текст',
        [
          { value: 'words', text: 'Частые слова' },
          { value: 'classics', text: 'Классика' },
        ],
        t.source,
        (v) => saveTestSettings({ source: v as TestSettings['source'] }),
      ),
      h(
        'div',
        { class: 'segment', attrs: { role: 'group', 'aria-label': 'Параметры' } },
        toggle('Заглавные', t.capitals, () => saveTestSettings({ capitals: !t.capitals })),
        toggle('Пунктуация', t.punctuation, () =>
          saveTestSettings({ punctuation: !t.punctuation }),
        ),
        toggle('ё = е', t.yoOptional, () => saveTestSettings({ yoOptional: !t.yoOptional })),
      ),
      toggle('Клавиатура', showKeyboard, () => {
        showKeyboard = !showKeyboard;
        keyboard.el.hidden = !showKeyboard;
        renderModebar();
      }),
    );
  }

  function restart(): void {
    window.clearInterval(timer);
    timer = undefined;
    overlay?.remove();
    overlay = undefined;
    setFocusMode(false);
    const t = settings();
    text = new TestText(Math.floor(Math.random() * 2 ** 31), t);
    const timed = t.lengthType === 'time';
    session = new TypingSession({
      text: text.words(timed ? TIMED_START_WORDS : t.length).join(' '),
      mode: 'flow',
      yoOptional: t.yoOptional,
      ...(timed ? { timeLimitMs: t.length * 1000 } : {}),
    });
    textLine.setSession(session);
    keyboard.highlight(session.text[0]);
    note.textContent = 'Таймер запустится с первой клавиши. Tab или Esc начинают заново.';
    note.className = 'lesson-note';
    renderStats();
  }

  function renderStats(now?: number): void {
    const st = session.stats(now);
    cpmEl.textContent = String(Math.round(st.cpm));
    accEl.textContent = String(Math.floor(st.accuracy));
    const t = settings();
    if (t.lengthType === 'time') {
      const left = Math.max(0, Math.ceil((t.length * 1000 - st.elapsedMs) / 1000));
      counter.textContent = String(left);
    } else {
      const done = session.text.slice(0, session.cursor).split(' ').length - 1;
      counter.textContent = `${done}/${t.length}`;
    }
  }

  function setFocusMode(on: boolean): void {
    document.body.classList.toggle('focus-mode', on);
  }

  function tick(): void {
    const now = performance.now();
    if (session.tick(now)) finish();
    else renderStats(now);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Tab' || (e.key === 'Escape' && !overlay)) {
      e.preventDefault();
      restart();
      return;
    }
    if (overlay) {
      onOverlayKey?.(e);
      return;
    }
    const kind = classifyKey(e);
    if (kind === 'ignore') return;
    e.preventDefault();

    const result = session.input(e, performance.now());
    if (result === 'wrongLayout') {
      note.textContent = 'Включите русскую раскладку: сейчас приходят латинские буквы.';
      note.className = 'lesson-note warn';
      return;
    }
    if (result === 'ignored') {
      if (session.status === 'finished') finish();
      return;
    }
    note.textContent = '';
    note.className = 'lesson-note';
    if (result !== 'backspace') keyboard.flash(e.key, e.code, result === 'correct');

    if (
      settings().lengthType === 'time' &&
      session.text.length - session.cursor < TIMED_MARGIN_CHARS
    ) {
      session.append(' ' + text.words(TIMED_MORE_WORDS).join(' '));
      textLine.refresh();
    } else {
      textLine.update();
    }
    keyboard.highlight(session.text[session.cursor]);
    setFocusMode(true);
    if (timer === undefined) timer = window.setInterval(tick, LIVE_STATS_MS);
    if (session.status === 'finished') finish();
    else renderStats(performance.now());
  }

  function finish(): void {
    if (overlay) return;
    window.clearInterval(timer);
    timer = undefined;
    setFocusMode(false);
    textLine.update();
    const stats = session.stats();
    renderStats();

    const t = settings();
    const key = configKey(t);
    const at = new Date().toISOString();
    const data = addSession(
      store.data,
      {
        at,
        mode: 'test',
        cpm: stats.cpm,
        rawCpm: stats.rawCpm,
        accuracy: stats.accuracy,
        durationMs: stats.elapsedMs,
        config: key,
      },
      stats.perKey,
    );
    const rec = updateRecord(data.records, key, { cpm: stats.cpm, accuracy: stats.accuracy, at });
    commit({ ...data, records: rec.records });

    const view = testResultOverlay({
      stats,
      isRecord: rec.isRecord,
      worstKeys: worstKeys(stats.perKey, 3),
      onRestart: restart,
    });
    overlay = view.el;
    onOverlayKey = view.onKey;
    el.append(overlay);
    view.focus();
  }

  function onBlur(): void {
    if (session.status !== 'running') return;
    session.pause(performance.now());
    note.textContent = 'Пауза. Нажмите любую клавишу или щёлкните, чтобы продолжить.';
    setFocusMode(false);
  }

  function onClick(): void {
    if (session.status !== 'paused') return;
    session.resume(performance.now());
    note.textContent = '';
  }

  function onMouseMove(): void {
    setFocusMode(false);
  }

  keyboard.el.hidden = true;
  renderModebar();
  restart();
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  el.addEventListener('click', onClick);

  return {
    el,
    destroy() {
      window.clearInterval(timer);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMouseMove);
      textLine.destroy();
      setFocusMode(false);
    },
  };
}
