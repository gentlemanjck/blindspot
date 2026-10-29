// Lesson screen: one exercise in stop-on-error mode (SPEC §4, §6, §7).

import { evaluate, recordResult, shouldShowHint } from '../curriculum/progress.ts';
import { STAGES, type ExerciseType, type Stage } from '../curriculum/ru.ts';
import { classifyKey, TypingSession, worstKeys, type Stats } from '../engine/index.ts';
import { navigate, type Route } from '../router.ts';
import { commit, criteria, store } from '../state.ts';
import { addSession } from '../storage/index.ts';
import { exerciseTypes, generate } from '../textgen/index.ts';
import { h, type Screen } from './dom.ts';
import { Keyboard } from './keyboard.ts';
import { resultOverlay } from './result.ts';
import { TextLine } from './textLine.ts';

export const EXERCISE_NAMES: Record<ExerciseType, string> = {
  keys: 'клавиши',
  combos: 'сочетания',
  words: 'слова',
  phrases: 'фразы',
};

const LIVE_STATS_MS = 250;

export function lessonScreen(stageId: number, exercise: number): Screen {
  const stage = STAGES.find((s) => s.id === stageId);
  const types = stage ? exerciseTypes(stageId) : [];
  const type = types[exercise];
  const status = store.data.course.stages[stageId]?.status;
  if (!stage || !type || status === undefined || status === 'locked') {
    queueMicrotask(() => navigate({ name: 'map' }));
    return { el: h('section') };
  }
  return mountLesson(stage, type, types, exercise);
}

function mountLesson(
  stage: Stage,
  type: ExerciseType,
  types: ExerciseType[],
  exercise: number,
): Screen {
  const stageId = stage.id;
  const textLine = new TextLine();
  const keyboard = store.data.settings.showKeyboard ? new Keyboard() : undefined;
  const cpmEl = h('b');
  const accEl = h('b');
  const timeEl = h('b');
  const note = h('p', { class: 'lesson-note', attrs: { role: 'status' } });
  // Red wedge under the text that grows with progress through the exercise.
  const wedge = h('div', { class: 'wedge', attrs: { 'aria-hidden': 'true' } });

  const el = h(
    'section',
    { class: 'page lesson' },
    h('span', {
      class: 'stage-ghost',
      text: String(stageId).padStart(2, '0'),
      attrs: { 'aria-hidden': 'true' },
    }),
    h(
      'header',
      { class: 'lesson-head' },
      h('h1', { class: 'title', text: `Этап ${stageId}` }),
      h('p', { class: 'lesson-keys', text: stage.title }),
      h('p', {
        class: 'lesson-sub',
        text: `Упражнение ${exercise + 1} из ${types.length}: ${EXERCISE_NAMES[type]}`,
      }),
    ),
    h('div', { class: 'type-zone' }, textLine.el, wedge),
    h(
      'div',
      { class: 'live-stats' },
      h('p', { class: 'stat stat-cpm' }, cpmEl, h('span', { text: 'зн/мин' })),
      h('p', { class: 'stat stat-acc' }, accEl, h('span', { text: '%' })),
      h('p', { class: 'stat-disc' }, timeEl),
    ),
    note,
    keyboard?.el,
  );

  function renderProgress(): void {
    wedge.style.setProperty('--p', String(session.cursor / session.text.length));
  }

  let session = newSession();
  let timer: number | undefined;
  let overlay: HTMLElement | undefined;
  let onOverlayKey: ((e: KeyboardEvent) => void) | undefined;

  function newSession(): TypingSession {
    const s = new TypingSession({
      text: generate(stageId, type, Math.floor(Math.random() * 2 ** 31)),
      mode: 'stop',
    });
    textLine.setSession(s);
    keyboard?.highlight(s.text[0]);
    note.textContent = 'Таймер запустится с первой клавиши.';
    note.className = 'lesson-note';
    return s;
  }

  function renderStats(now?: number): void {
    const st = session.stats(now);
    cpmEl.textContent = String(Math.round(st.cpm));
    accEl.textContent = String(Math.floor(st.accuracy));
    const sec = Math.floor(st.elapsedMs / 1000);
    timeEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  function setFocusMode(on: boolean): void {
    document.body.classList.toggle('focus-mode', on);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (overlay) {
      onOverlayKey?.(e);
      return;
    }
    if (e.key === 'Escape') {
      setFocusMode(false);
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
    if (result === 'ignored' || result === 'backspace') return;

    note.textContent = '';
    note.className = 'lesson-note';
    keyboard?.flash(e.key, e.code, result === 'correct');
    textLine.update();
    renderProgress();
    keyboard?.highlight(session.text[session.cursor]);
    setFocusMode(true);
    if (timer === undefined)
      timer = window.setInterval(() => renderStats(performance.now()), LIVE_STATS_MS);
    if (session.status === 'finished') finish();
  }

  function onBlur(): void {
    if (session.status !== 'running') return;
    session.pause(performance.now());
    note.textContent = 'Пауза. Нажмите любую клавишу или щёлкните, чтобы продолжить.';
    note.className = 'lesson-note';
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

  function finish(): void {
    window.clearInterval(timer);
    timer = undefined;
    setFocusMode(false);
    const stats = session.stats();
    renderStats();
    const ev = evaluate(stats, stage, criteria());
    const key = `${stageId}-${exercise}`;
    const failures = ev.passed ? 0 : (store.failures.get(key) ?? 0) + 1;
    store.failures.set(key, failures);

    const at = new Date().toISOString();
    const data = addSession(
      store.data,
      {
        at,
        mode: 'lesson',
        stageId,
        exerciseType: type,
        cpm: stats.cpm,
        rawCpm: stats.rawCpm,
        accuracy: stats.accuracy,
        durationMs: stats.elapsedMs,
      },
      stats.perKey,
    );
    if (ev.passed) {
      data.course = recordResult(
        data.course,
        stageId,
        exercise,
        { cpm: stats.cpm, accuracy: stats.accuracy, passed: true },
        at,
      );
    }
    commit(data);

    const next = ev.passed ? nextRoute() : undefined;
    const view = resultOverlay({
      stats,
      evaluation: ev,
      passAccuracy: criteria().passAccuracy,
      showHint: shouldShowHint(failures),
      problemKeys: problemKeys(stats),
      onRetry: retry,
      ...(next ? { onNext: () => navigate(next) } : {}),
    });
    overlay = view.el;
    onOverlayKey = view.onKey;
    el.append(overlay);
    view.focus();
  }

  function retry(): void {
    overlay?.remove();
    overlay = undefined;
    session = newSession();
    renderStats();
    renderProgress();
  }

  function nextRoute(): Route {
    if (exercise + 1 < types.length)
      return { name: 'lesson', stage: stageId, exercise: exercise + 1 };
    const nextStage = store.data.course.stages[stageId + 1];
    if (nextStage && nextStage.status !== 'locked')
      return { name: 'lesson', stage: stageId + 1, exercise: 0 };
    return { name: 'map' };
  }

  renderStats();
  renderProgress();
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

/** Up to three keys with misses, most missed first. */
function problemKeys(stats: Stats): string[] {
  return worstKeys(stats.perKey, 3).filter((ch) => (stats.perKey.get(ch)?.misses ?? 0) > 0);
}
