// "Hands on the keyboard": the home position, shown once before the first exercise (SPEC §7).

import hands from '../assets/hands.webp';
import { href } from '../router.ts';
import { commit, store } from '../state.ts';
import { continueRoute } from './courseMap.ts';
import { h, type Screen } from './dom.ts';

/** Fingers with their home keys, in the keyboard's finger-zone tones. */
const FINGERS: { tone: string; keys: string; name: string }[] = [
  { tone: 'index', keys: 'А · О', name: 'указательные' },
  { tone: 'middle', keys: 'В · Л', name: 'средние' },
  { tone: 'ring', keys: 'Ы · Д', name: 'безымянные' },
  { tone: 'pinky', keys: 'Ф · Ж', name: 'мизинцы' },
  { tone: 'thumb', keys: '␣', name: 'большие, пробел' },
];

const TIPS = [
  'Нащупайте выступы на А и О: на них лежат указательные пальцы.',
  'Смотрите на экран, а не на руки. Подсказка — экранная клавиатура.',
  'Держите запястья ровно, не опирайтесь ими на стол.',
];

export function handsScreen(): Screen {
  if (!store.data.handsSeen) commit({ ...store.data, handsSeen: true });
  const next = continueRoute();

  return {
    el: h(
      'section',
      { class: 'page hands' },
      h('h1', { class: 'title', text: 'Руки на клавиатуре' }),
      h(
        'div',
        { class: 'hands-main' },
        h(
          'div',
          { class: 'sheet' },
          h('img', {
            attrs: {
              src: hands,
              width: '1600',
              height: '893',
              alt: 'Две руки над клавиатурой: каждый палец закрашен своим тоном, как зоны на экранной клавиатуре.',
            },
          }),
        ),
        h(
          'ul',
          { class: 'finger-legend', attrs: { 'aria-label': 'Исходная позиция' } },
          ...FINGERS.map((f) =>
            h(
              'li',
              { attrs: { 'data-tone': f.tone } },
              h('span', { class: 'finger-keys', text: f.keys }),
              h('span', { class: 'finger-name', text: f.name }),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'hands-aside' },
        h('p', {
          class: 'lead',
          text: 'Перед каждым упражнением ставьте пальцы в исходную позицию: левая рука на Ф Ы В А, правая на О Л Д Ж, большие пальцы на пробеле. Каждый палец отвечает за свою зону и возвращается домой после нажатия.',
        }),
        h('ul', { class: 'tips' }, ...TIPS.map((t) => h('li', { text: t }))),
        h(
          'p',
          { class: 'actions' },
          next
            ? h('a', {
                class: 'btn primary',
                text: 'Понятно, к упражнению',
                attrs: { href: href(next) },
              })
            : h('a', { class: 'btn primary', text: 'К курсу', attrs: { href: '#/' } }),
        ),
      ),
    ),
  };
}
