// Home: a poster headline beside Lissitzky's wedge, then the course as a list of stages (SPEC §7).

import lissitzky from '../assets/lissitzky.webp';
import { remainingStages, type StageProgress } from '../curriculum/progress.ts';
import { COURSE_COMPLETE_STAGE, STAGES, type Stage } from '../curriculum/ru.ts';
import { href, type Route } from '../router.ts';
import { store } from '../state.ts';
import { exerciseTypes } from '../textgen/index.ts';
import { h, type Screen } from './dom.ts';

/** First exercise not passed yet, or the first one when the stage is done. */
function startExercise(stage: Stage, p: StageProgress): number {
  const count = exerciseTypes(stage.id).length;
  for (let i = 0; i < count; i++) if (!p.exercisesPassed.includes(i)) return i;
  return 0;
}

/** The exercise to continue with, or undefined when every stage is done. */
export function continueRoute(): Route | undefined {
  const stages = store.data.course.stages;
  const stage = STAGES.find((s) => stages[s.id]?.status === 'current');
  const p = stage && stages[stage.id];
  return stage && p
    ? { name: 'lesson', stage: stage.id, exercise: startExercise(stage, p) }
    : undefined;
}

/** True before the first passed exercise. */
export function isFreshStart(): boolean {
  return store.data.course.stages[1]?.exercisesPassed.length === 0;
}

function stageRow(stage: Stage, p: StageProgress): HTMLElement {
  const count = exerciseTypes(stage.id).length;
  const lessonHref = href({ name: 'lesson', stage: stage.id, exercise: startExercise(stage, p) });
  const isLetters = stage.kind === 'letters';
  const title = h('span', {
    class: `stage-title${isLetters ? ' letters' : ''}`,
    text: stage.title,
  });

  let meta: string;
  if (p.status === 'locked') meta = '';
  else if (p.status === 'done')
    meta = `${Math.round(p.bestCpm)} зн/мин, ${Math.floor(p.bestAccuracy)} %`;
  else meta = `${p.exercisesPassed.length} из ${count}`;

  const body =
    p.status === 'locked'
      ? h('span', { class: 'stage-link' }, title)
      : h('a', { class: 'stage-link', attrs: { href: lessonHref } }, title);

  return h(
    'li',
    { class: `stage ${p.status}`, attrs: { 'data-stage': String(stage.id) } },
    h('span', { class: 'stage-num', text: String(stage.id) }),
    body,
    p.status === 'done' ? h('span', { class: 'sr-only', text: 'пройден' }) : null,
    meta ? h('span', { class: 'stage-meta', text: meta }) : null,
  );
}

export function courseMapScreen(): Screen {
  const progress = store.data.course;
  const remaining = remainingStages(progress);
  const next = continueRoute();

  const cont =
    next?.name === 'lesson'
      ? h('a', {
          class: 'btn primary',
          text: isFreshStart() ? 'Начать курс' : `Продолжить этап ${next.stage}`,
          attrs: { href: href(next) },
        })
      : null;

  const test =
    remaining.length === 0
      ? h(
          'p',
          { class: 'test-entry' },
          h('a', { text: 'Тест скорости', attrs: { href: '#/test' } }),
          ' открыт.',
        )
      : h('p', {
          class: 'test-entry locked',
          text: `Тест скорости откроется после этапа ${COURSE_COMPLETE_STAGE}. Осталось этапов: ${remaining.length}.`,
        });

  const hero = h(
    'div',
    { class: 'hero' },
    h(
      'div',
      { class: 'hero-text' },
      h(
        'h1',
        { class: 'hero-title' },
        h('span', { text: 'Слепая' }),
        ' ',
        h('span', { class: 'outline', text: 'печать' }),
      ),
      h('p', {
        class: 'lead',
        text: `Курс из ${COURSE_COMPLETE_STAGE} этапов: от двух букв в центре клавиатуры до предложений. Потом открывается тест скорости.`,
      }),
      h(
        'p',
        { class: 'actions' },
        cont,
        h('a', { class: 'btn', text: 'Как держать руки', attrs: { href: '#/hands' } }),
      ),
      h('p', {
        class: 'hero-note',
        text: 'Раскладка: русская для macOS (ISO). Включите её перед началом.',
      }),
    ),
    h(
      'figure',
      { class: 'hero-poster' },
      h(
        'div',
        { class: 'sheet' },
        h('img', {
          attrs: {
            src: lissitzky,
            width: '1600',
            height: '1352',
            alt: 'Плакат Эля Лисицкого: красный клин врезается в белый круг на чёрном поле.',
          },
        }),
      ),
      h(
        'figcaption',
        {},
        h('span', { class: 'hero-slogan', text: 'Клином красным — по белым клавишам' }),
        h('span', { class: 'hero-credit', text: 'Эль Лисицкий. Клином красным бей белых. 1920' }),
      ),
    ),
  );

  return {
    el: h(
      'section',
      { class: 'page course' },
      hero,
      h('h2', { class: 'subtitle', text: 'Этапы' }),
      h(
        'ol',
        { class: 'stages' },
        ...STAGES.map((s) => {
          const p = progress.stages[s.id];
          return p ? stageRow(s, p) : null;
        }),
      ),
      test,
    ),
  };
}
