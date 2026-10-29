// Progress screen: summary, history table and per-key accuracy (SPEC §7).

import { store } from '../state.ts';
import { historyLabel, keyAccuracy, summary } from '../stats/index.ts';
import { charName, h, type Screen } from './dom.ts';

const PAGE = 50;
const MIN_KEY_PRESSES = 10;

const dateFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function statsScreen(): Screen {
  const data = store.data;
  const sum = summary(data);

  if (data.history.length === 0) {
    return {
      el: h(
        'section',
        { class: 'page stats' },
        h('h1', { class: 'title', text: 'Прогресс' }),
        h('p', {
          class: 'lead',
          text: 'Здесь появятся история занятий и точность по каждой клавише — после первого упражнения.',
        }),
        h(
          'p',
          { class: 'actions' },
          h('a', { class: 'btn primary', text: 'Начать с этапа 1', attrs: { href: '#/' } }),
        ),
      ),
    };
  }

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
