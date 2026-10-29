// Result screens as posters: the remark on a diagonal band, figures in solid blocks (SPEC §7).

import type { Evaluation } from '../curriculum/progress.ts';
import type { Stats } from '../engine/index.ts';
import { charName, h } from './dom.ts';

export interface ResultProps {
  stats: Stats;
  evaluation: Evaluation;
  passAccuracy: number;
  showHint: boolean;
  problemKeys: string[];
  onRetry: () => void;
  /** Present only when the exercise is passed. */
  onNext?: () => void;
}

function remark(p: ResultProps): string {
  const { evaluation: ev, stats } = p;
  if (ev.passed) return stats.accuracy === 100 ? 'Без ошибок' : 'Молодец';
  if (p.showHint) return 'Не торопись: сначала точность, скорость придёт';
  if (!ev.accuracyOk) return 'Медленнее, следи за точностью';
  return 'Точно! Теперь чуть быстрее';
}

export function resultOverlay(p: ResultProps): {
  el: HTMLElement;
  focus: () => void;
  onKey: (e: KeyboardEvent) => void;
} {
  const { stats, evaluation: ev } = p;
  const primary = h('button', {
    class: 'btn primary',
    text: p.onNext ? 'Дальше' : 'Ещё раз',
    on: { click: () => (p.onNext ?? p.onRetry)() },
  });
  const secondary = p.onNext
    ? h('button', { class: 'btn', text: 'Ещё раз', on: { click: () => p.onRetry() } })
    : h('a', { class: 'btn', text: 'К курсу', attrs: { href: '#/' } });

  const figure = (value: string, unit: string, ok: boolean, need: string) =>
    h(
      'div',
      { class: `figure${ok ? '' : ' short'}` },
      h('span', { class: 'figure-value', text: value }),
      h('span', { class: 'figure-unit', text: unit }),
      h('span', { class: 'figure-need', text: need }),
    );

  const el = h(
    'div',
    {
      class: 'result',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'result-title' },
    },
    h(
      'div',
      { class: 'result-sheet' },
      h('p', { class: 'remark', text: remark(p), attrs: { id: 'result-title' } }),
      h(
        'div',
        { class: 'figures' },
        figure(String(Math.round(stats.cpm)), 'зн/мин', ev.cpmOk, `нужно ${ev.cpmTarget}`),
        figure(
          `${Math.floor(stats.accuracy)} %`,
          'точность',
          ev.accuracyOk,
          `нужно ${p.passAccuracy} %`,
        ),
      ),
      p.problemKeys.length
        ? h('p', {
            class: 'result-keys',
            text: `Ошибки чаще всего: ${p.problemKeys.map(charName).join(', ')}`,
          })
        : null,
      h('div', { class: 'actions' }, primary, secondary),
      h('p', {
        class: 'result-hint',
        text: p.onNext ? 'Enter: дальше, R: ещё раз' : 'Enter: ещё раз',
      }),
    ),
  );

  return {
    el,
    focus: () => primary.focus(),
    onKey: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (p.onNext ?? p.onRetry)();
      } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        p.onRetry();
      } else if (e.key === 'Escape') {
        location.hash = '#/';
      }
    },
  };
}

export interface TestResultProps {
  stats: Stats;
  isRecord: boolean;
  worstKeys: string[];
  onRestart: () => void;
}

/** Speed test result (SPEC §5): CPM, accuracy, raw CPM, errors, worst keys, record badge. */
export function testResultOverlay(p: TestResultProps): {
  el: HTMLElement;
  focus: () => void;
  onKey: (e: KeyboardEvent) => void;
} {
  const { stats } = p;
  const primary = h('button', {
    class: 'btn primary',
    text: 'Ещё раз',
    on: { click: () => p.onRestart() },
  });
  const figure = (value: string, unit: string, cls = '') =>
    h(
      'div',
      { class: `figure${cls}` },
      h('span', { class: 'figure-value', text: value }),
      h('span', { class: 'figure-unit', text: unit }),
    );

  const el = h(
    'div',
    {
      class: 'result',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'result-title' },
    },
    h(
      'div',
      { class: 'result-sheet' },
      h('p', {
        class: 'remark',
        text: p.isRecord ? 'Новый рекорд' : 'Результат',
        attrs: { id: 'result-title' },
      }),
      h(
        'div',
        { class: 'figures' },
        figure(String(Math.round(stats.cpm)), 'зн/мин'),
        figure(`${Math.floor(stats.accuracy)} %`, 'точность'),
      ),
      h(
        'p',
        { class: 'result-extra' },
        h('span', { text: `Без учёта ошибок: ${Math.round(stats.rawCpm)} зн/мин` }),
        h('span', { text: `Ошибок: ${stats.errors}` }),
      ),
      p.worstKeys.length
        ? h('p', {
            class: 'result-keys',
            text: `Слабые клавиши: ${p.worstKeys.map(charName).join(', ')}`,
          })
        : null,
      h(
        'div',
        { class: 'actions' },
        primary,
        h('a', { class: 'btn', text: 'К курсу', attrs: { href: '#/' } }),
      ),
      h('p', { class: 'result-hint', text: 'Enter, Tab или Esc: ещё раз' }),
    ),
  );

  return {
    el,
    focus: () => primary.focus(),
    onKey: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        p.onRestart();
      }
    },
  };
}
