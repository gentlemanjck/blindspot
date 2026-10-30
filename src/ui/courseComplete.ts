// "Course complete": a full-screen poster shown once, right after the last course stage (SPEC §7).

import poster from '../assets/course-complete.webp';
import { isCourseComplete } from '../curriculum/progress.ts';
import { COURSE_COMPLETE_STAGE } from '../curriculum/ru.ts';
import { redirect } from '../router.ts';
import { store } from '../state.ts';
import { courseSummary } from '../stats/index.ts';
import { h, type Screen } from './dom.ts';

export function courseCompleteScreen(): Screen {
  if (!isCourseComplete(store.data.course)) {
    queueMicrotask(() => redirect({ name: 'map' }));
    return { el: h('section') };
  }
  const sum = courseSummary(store.data);
  const primary = h('a', {
    class: 'btn primary',
    text: 'К тесту скорости',
    attrs: { href: '#/test' },
  });

  const figure = (value: string, unit: string) =>
    h(
      'div',
      { class: 'complete-figure' },
      h('span', { class: 'figure-value', text: value }),
      h('span', { class: 'figure-unit', text: unit }),
    );

  const el = h(
    'section',
    { class: 'complete', attrs: { 'aria-labelledby': 'complete-title' } },
    h('img', { class: 'complete-poster', attrs: { src: poster, alt: '', 'aria-hidden': 'true' } }),
    h(
      'div',
      { class: 'complete-plate' },
      h('p', {
        class: 'complete-stage',
        text: `Этап ${COURSE_COMPLETE_STAGE} из ${COURSE_COMPLETE_STAGE}`,
      }),
      h('h1', { class: 'complete-title', text: 'Курс пройден', attrs: { id: 'complete-title' } }),
      h('p', {
        class: 'complete-text',
        text: 'Все буквы и знаки на своих местах. Теперь проверьте скорость на свободном тексте.',
      }),
      h(
        'div',
        { class: 'complete-figures' },
        figure(
          sum.bestCpm === null ? '—' : String(Math.round(sum.bestCpm)),
          'зн/мин, лучшая скорость',
        ),
        figure(
          sum.meanAccuracy === null ? '—' : `${Math.floor(sum.meanAccuracy)} %`,
          'средняя точность',
        ),
      ),
      h(
        'p',
        { class: 'actions' },
        primary,
        h('a', { class: 'btn', text: 'К курсу', attrs: { href: '#/' } }),
      ),
    ),
  );

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') location.hash = '#/';
  }
  document.addEventListener('keydown', onKey);
  queueMicrotask(() => primary.focus());

  return { el, destroy: () => document.removeEventListener('keydown', onKey) };
}
