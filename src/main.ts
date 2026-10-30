import './styles/tokens.css';
import './styles/app.css';
import logo from './assets/logo.svg?raw';
import { startRouter, type Route } from './router.ts';
import { applyTheme, store } from './state.ts';
import { courseCompleteScreen } from './ui/courseComplete.ts';
import { courseMapScreen } from './ui/courseMap.ts';
import { h, type Screen } from './ui/dom.ts';
import { handsScreen } from './ui/handsScreen.ts';
import { lessonScreen } from './ui/lesson.ts';
import { settingsScreen } from './ui/settingsScreen.ts';
import { speedTestScreen } from './ui/speedTest.ts';
import { statsScreen } from './ui/statsScreen.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app is missing');

const navItems: { route: Route['name']; label: string; hash: string }[] = [
  { route: 'map', label: 'Курс', hash: '#/' },
  { route: 'test', label: 'Тест скорости', hash: '#/test' },
  { route: 'stats', label: 'Прогресс', hash: '#/stats' },
  { route: 'settings', label: 'Настройки', hash: '#/settings' },
];

const nav = h('nav', { class: 'nav', attrs: { 'aria-label': 'Разделы' } });
// Inline SVG so the circle takes the theme's ink through currentColor.
const brandMark = h('span', { class: 'brand-mark', attrs: { 'aria-hidden': 'true' } });
brandMark.innerHTML = logo;
brandMark.querySelector('svg')?.removeAttribute('role');
brandMark.querySelector('svg')?.removeAttribute('aria-label');
const header = h(
  'header',
  { class: 'header' },
  h('a', { class: 'brand', attrs: { href: '#/' } }, brandMark, 'Слепая печать'),
  nav,
);
const main = h('main', { class: 'main' });
const narrow = h('p', {
  class: 'narrow',
  text: 'Для тренажёра нужна физическая клавиатура и экран шириной от 1024 пикселей.',
});
const storageWarning = h('p', {
  class: 'storage-warning',
  text: 'Прогресс не сохранится: браузер запрещает этому сайту хранить данные.',
  attrs: { role: 'status' },
});
app.append(header, storageWarning, main, narrow);

applyTheme(store.data.settings.theme);

let current: Screen | undefined;

const TITLES: Record<Route['name'], string> = {
  map: 'Курс',
  lesson: 'Урок',
  hands: 'Руки на клавиатуре',
  complete: 'Курс пройден',
  test: 'Тест скорости',
  stats: 'Прогресс',
  settings: 'Настройки',
};

function render(route: Route): void {
  storageWarning.hidden = store.canSave;
  const title = route.name === 'lesson' ? `Этап ${route.stage}` : TITLES[route.name];
  document.title = `${title} — Слепая печать`;
  current?.destroy?.();
  main.replaceChildren();
  nav.replaceChildren(
    ...navItems.map((item) =>
      h('a', {
        text: item.label,
        attrs: {
          href: item.hash,
          ...(isSection(route, item.route) ? { 'aria-current': 'page' } : {}),
        },
      }),
    ),
  );
  current = screenFor(route);
  main.append(current.el);
  window.scrollTo(0, 0);
}

function isSection(route: Route, section: Route['name']): boolean {
  const inCourse = ['lesson', 'hands', 'complete'].includes(route.name);
  return route.name === section || (section === 'map' && inCourse);
}

function screenFor(route: Route): Screen {
  switch (route.name) {
    case 'map':
      return courseMapScreen();
    case 'lesson':
      return lessonScreen(route.stage, route.exercise);
    case 'hands':
      return handsScreen();
    case 'complete':
      return courseCompleteScreen();
    case 'test':
      return speedTestScreen();
    case 'stats':
      return statsScreen();
    case 'settings':
      return settingsScreen();
  }
}

startRouter(render);
