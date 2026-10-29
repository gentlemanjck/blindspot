// Home: the course as a notebook's table of contents (SPEC §7).

import { remainingStages, type StageProgress } from '../curriculum/progress.ts';
import { STAGES, type Stage } from '../curriculum/ru.ts';
import { href } from '../router.ts';
import { store } from '../state.ts';
import { exerciseTypes } from '../textgen/index.ts';
import { h, type Screen } from './dom.ts';

/** First exercise not passed yet, or the first one when the stage is done. */
function startExercise(stage: Stage, p: StageProgress): number {
  const count = exerciseTypes(stage.id).length;
  for (let i = 0; i < count; i++) if (!p.exercisesPassed.includes(i)) return i;
  return 0;
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
    p.status === 'done'
      ? h('span', { class: 'tick', text: '✓', attrs: { 'aria-label': 'пройден' } })
      : null,
    meta ? h('span', { class: 'stage-meta', text: meta }) : null,
  );
}

export function courseMapScreen(): Screen {
  const progress = store.progress;
  const current = STAGES.find((s) => progress.stages[s.id]?.status === 'current');
  const currentProgress = current ? progress.stages[current.id] : undefined;
  const remaining = remainingStages(progress);

  const cont =
    current && currentProgress
      ? h('a', {
          class: 'btn primary',
          text:
            currentProgress.exercisesPassed.length === 0 && current.id === 1
              ? 'Начать с этапа 1'
              : `Продолжить этап ${current.id}`,
          attrs: {
            href: href({
              name: 'lesson',
              stage: current.id,
              exercise: startExercise(current, currentProgress),
            }),
          },
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
          text: `Тест скорости откроется после этапа 17. Осталось этапов: ${remaining.length}.`,
        });

  return {
    el: h(
      'section',
      { class: 'page course' },
      h('h1', { class: 'title', text: 'Курс слепой печати' }),
      h('p', {
        class: 'lead',
        text: 'От двух букв под указательными пальцами до цифр. Следующий этап открывается, когда пройдены все упражнения текущего.',
      }),
      cont ? h('p', { class: 'actions' }, cont) : null,
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
