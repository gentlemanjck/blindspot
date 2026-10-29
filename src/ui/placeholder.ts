import { h, type Screen } from './dom.ts';

export function placeholderScreen(title: string, text: string): Screen {
  return {
    el: h(
      'section',
      { class: 'page' },
      h('h1', { class: 'title', text: title }),
      h('p', { class: 'lead', text }),
    ),
  };
}
