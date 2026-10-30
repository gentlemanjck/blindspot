// Progress screen: summary, keyboard heatmap, history table and per-key accuracy (SPEC §7).

import { keyByCode } from '../layouts/ru-mac-iso.ts';
import emptyProgress from '../assets/empty-progress.webp';
import { COURSE_COMPLETE_STAGE } from '../curriculum/ru.ts';
import { href } from '../router.ts';
import { store } from '../state.ts';
import { historyLabel, keyAccuracy, keyHeat, summary, type KeyHeat } from '../stats/index.ts';
import { continueRoute } from './courseMap.ts';
import { charName, h, type Screen } from './dom.ts';
import { Keyboard } from './keyboard.ts';

const PAGE = 50;
const MIN_KEY_PRESSES = 10;

/** Accuracy at or below this is full red on the heatmap. */
const HEAT_FLOOR_ACCURACY = 85;

type HeatMetric = 'accuracy' | 'speed';

const dateFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function statsScreen(): Screen {
  const data = store.data;
  const sum = summary(data);

  if (data.history.length === 0) return emptyStats();

  const block = (value: string, label: string, cls = '') =>
    h(
      'div',
      { class: `figure${cls}` },
      h('span', { class: 'figure-value', text: value }),
      h('span', { class: 'figure-unit', text: label }),
    );

  // History, newest first, shown a page at a time.
  const newest = [...data.history].reverse();
  const tbody = h('tbody');
  const more = h('button', { class: 'btn', text: 'Показать ещё' });
  let shown = 0;
  function showMore(): void {
    for (const e of newest.slice(shown, shown + PAGE)) {
      tbody.append(
        h(
          'tr',
          {},
          h('td', { text: dateFormat.format(new Date(e.at)) }),
          h('td', { text: historyLabel(e) }),
          h('td', { class: 'num', text: String(Math.round(e.cpm)) }),
          h('td', { class: 'num', text: `${Math.floor(e.accuracy)} %` }),
        ),
      );
    }
    shown += PAGE;
    more.hidden = shown >= newest.length;
  }
  more.addEventListener('click', showMore);
  showMore();

  const keys = keyAccuracy(data.keyStats, MIN_KEY_PRESSES);
  const heatmap = keys.length ? heatmapSection(keyHeat(data.keyStats, MIN_KEY_PRESSES)) : null;

  return {
    el: h(
      'section',
      { class: 'page stats' },
      h('h1', { class: 'title', text: 'Прогресс' }),
      h(
        'div',
        { class: 'figures summary' },
        block(String(sum.lessons), 'упражнений'),
        block(String(sum.tests), 'тестов'),
        block(
          sum.bestTestCpm === null ? '—' : String(Math.round(sum.bestTestCpm)),
          'лучший тест, зн/мин',
          ' short',
        ),
        block(
          sum.recentAccuracy === null ? '—' : `${Math.floor(sum.recentAccuracy)} %`,
          'точность за 20 занятий',
        ),
      ),
      heatmap,
      h(
        'div',
        { class: 'stats-grid' },
        h(
          'section',
          {},
          h('h2', { class: 'subtitle', text: 'История' }),
          h(
            'table',
            { class: 'table' },
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', { text: 'Когда' }),
                h('th', { text: 'Что' }),
                h('th', { class: 'num', text: 'Зн/мин' }),
                h('th', { class: 'num', text: 'Точность' }),
              ),
            ),
            tbody,
          ),
          more,
        ),
        h(
          'section',
          {},
          h('h2', { class: 'subtitle', text: 'Точность по клавишам' }),
          keys.length
            ? h(
                'table',
                { class: 'table' },
                h(
                  'thead',
                  {},
                  h(
                    'tr',
                    {},
                    h('th', { text: 'Клавиша' }),
                    h('th', { class: 'num', text: 'Точность' }),
                    h('th', { class: 'num', text: 'Промахи' }),
                    h('th', { class: 'num', text: 'Время, мс' }),
                  ),
                ),
                h(
                  'tbody',
                  {},
                  ...keys.map((k) =>
                    h(
                      'tr',
                      { class: k.accuracy < 90 ? 'weak' : '' },
                      h('td', { class: 'key-char', text: charName(k.char) }),
                      h('td', { class: 'num', text: `${Math.floor(k.accuracy)} %` }),
                      h('td', { class: 'num', text: String(k.misses) }),
                      h('td', {
                        class: 'num',
                        text: k.meanMs === null ? '—' : String(Math.round(k.meanMs)),
                      }),
                    ),
                  ),
                ),
              )
            : h('p', {
                class: 'lead',
                text: `Клавиша появится здесь, когда вы нажмёте её хотя бы ${MIN_KEY_PRESSES} раз.`,
              }),
        ),
      ),
    ),
  };
}

/** Keyboard coloured by accuracy or by speed, with a switch and a legend. */
function heatmapSection(rows: KeyHeat[]): HTMLElement {
  const keyboard = new Keyboard();
  const legendLow = h('span');
  const legendHigh = h('span');
  const buttons = new Map<HeatMetric, HTMLElement>();

  const timed = rows.flatMap((r) => (r.meanMs === null ? [] : [r.meanMs]));
  const fastest = Math.min(...timed);
  const slowest = Math.max(...timed);

  function level(r: KeyHeat, metric: HeatMetric): number | null {
    if (metric === 'accuracy') {
      return Math.min(1, Math.max(0, (100 - r.accuracy) / (100 - HEAT_FLOOR_ACCURACY)));
    }
    if (r.meanMs === null) return null;
    return slowest > fastest ? (r.meanMs - fastest) / (slowest - fastest) : 0;
  }

  function show(metric: HeatMetric): void {
    const levels = new Map<string, { level: number; title: string }>();
    for (const r of rows) {
      const l = level(r, metric);
      if (l === null) continue;
      const name = charName(keyByCode(r.code)?.normal ?? r.code);
      const time = r.meanMs === null ? '' : `, в среднем ${Math.round(r.meanMs)} мс`;
      levels.set(r.code, {
        level: l,
        title: `${name}: точность ${Math.floor(r.accuracy)} %, нажатий: ${r.hits + r.misses}${time}`,
      });
    }
    keyboard.heat(levels);
    for (const [m, b] of buttons) b.setAttribute('aria-pressed', String(m === metric));
    if (metric === 'accuracy') {
      legendLow.textContent = 'без ошибок';
      legendHigh.textContent = `${HEAT_FLOOR_ACCURACY} % и ниже`;
    } else {
      legendLow.textContent = `быстрее, ${Math.round(fastest)} мс`;
      legendHigh.textContent = `медленнее, ${Math.round(slowest)} мс`;
    }
  }

  const options: { value: HeatMetric; text: string }[] = [
    { value: 'accuracy', text: 'Точность' },
    { value: 'speed', text: 'Скорость' },
  ];
  const segment = h(
    'div',
    { class: 'segment', attrs: { role: 'group', 'aria-label': 'Что показать на карте' } },
    ...options.map((o) => {
      const b = h('button', {
        class: 'seg-btn',
        text: o.text,
        attrs: { type: 'button', 'aria-pressed': 'false' },
        on: { click: () => show(o.value) },
      });
      buttons.set(o.value, b);
      return b;
    }),
  );
  if (!timed.length) buttons.get('speed')?.setAttribute('disabled', '');

  show('accuracy');
  return h(
    'section',
    { class: 'heatmap-block' },
    h(
      'div',
      { class: 'heatmap-head' },
      h('h2', { class: 'subtitle', text: 'Карта клавиатуры' }),
      segment,
    ),
    keyboard.el,
    h(
      'p',
      { class: 'heat-legend' },
      legendLow,
      h('span', { class: 'heat-scale', attrs: { 'aria-hidden': 'true' } }),
      legendHigh,
    ),
    h('p', {
      class: 'hint',
      text: `Наведите на клавишу, чтобы увидеть цифры. Пустые клавиши нажаты меньше ${MIN_KEY_PRESSES} раз.`,
    }),
  );
}

/** Before the first exercise: an illustration and empty figures instead of tables. */
function emptyStats(): Screen {
  const next = continueRoute();
  const cell = (value: string, label: string) =>
    h(
      'div',
      { class: 'empty-cell' },
      h('span', { class: 'figure-value', text: value }),
      h('span', { class: 'figure-unit', text: label }),
    );
  return {
    el: h(
      'section',
      { class: 'page stats-empty' },
      h(
        'div',
        { class: 'sheet' },
        h('img', {
          attrs: {
            src: emptyProgress,
            width: '1000',
            height: '1000',
            alt: '',
            'aria-hidden': 'true',
          },
        }),
      ),
      h(
        'div',
        { class: 'stats-empty-text' },
        h('p', { class: 'eyebrow', text: 'Прогресс' }),
        h('h1', { class: 'title', text: 'Здесь будет твой путь' }),
        h('p', {
          class: 'lead',
          text: 'История занятий, скорость и точность по каждой клавише появятся после первого упражнения.',
        }),
        h(
          'div',
          { class: 'empty-cells' },
          cell('—', 'зн/мин'),
          cell('—', 'точность'),
          cell(`1 / ${COURSE_COMPLETE_STAGE}`, 'этап'),
        ),
        h(
          'p',
          { class: 'actions' },
          h('a', {
            class: 'btn primary',
            text: 'Начать первое упражнение',
            attrs: { href: next ? href(next) : '#/' },
          }),
        ),
      ),
    ),
  };
}
