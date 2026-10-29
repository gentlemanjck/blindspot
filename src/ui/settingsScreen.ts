// Settings: pass criteria, keyboard, theme, reset progress, data sources (SPEC §7).

import { DEFAULT_CRITERIA } from '../curriculum/ru.ts';
import { applyTheme, commit, store } from '../state.ts';
import { parseCriteria } from '../stats/index.ts';
import { resetProgress, type Settings, type Theme } from '../storage/index.ts';
import { h, type Screen } from './dom.ts';

const BANDS = ['Этапы 1–5', 'Этапы 6–10', 'Этапы 11–15', 'Этапы 16–19'];
const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

function saveSettings(patch: Partial<Settings>): void {
  commit({ ...store.data, settings: { ...store.data.settings, ...patch } });
}

let fieldId = 0;
function field(label: string, input: HTMLInputElement, suffix: string): HTMLElement {
  input.id = `field-${++fieldId}`;
  return h(
    'div',
    { class: 'field' },
    h('label', { text: label, attrs: { for: input.id } }),
    h('span', { class: 'field-input' }, input, h('span', { text: suffix })),
  );
}

function checkbox(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLElement {
  const input = h('input', { attrs: { type: 'checkbox' } });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'check' }, input, h('span', { text: label }));
}

export function settingsScreen(): Screen {
  const s = store.data.settings;

  // ---- Pass criteria ----
  const number = (value: number) =>
    h('input', { attrs: { type: 'number', inputmode: 'numeric', value: String(value) } });
  const accuracy = number(s.passAccuracy);
  const targets = s.cpmTargets.map(number);
  const criteriaMsg = h('p', { class: 'form-msg', attrs: { role: 'status' } });

  function saveCriteria(e: Event): void {
    e.preventDefault();
    const parsed = parseCriteria(
      accuracy.value,
      targets.map((t) => t.value),
    );
    if (!parsed.ok) {
      criteriaMsg.textContent = parsed.error;
      criteriaMsg.className = 'form-msg error';
      return;
    }
    saveSettings({
      passAccuracy: parsed.criteria.passAccuracy,
      cpmTargets: [...parsed.criteria.cpmTargets],
    });
    criteriaMsg.textContent = 'Критерии сохранены.';
    criteriaMsg.className = 'form-msg';
  }

  function restoreDefaults(): void {
    accuracy.value = String(DEFAULT_CRITERIA.passAccuracy);
    DEFAULT_CRITERIA.cpmTargets.forEach((v, i) => {
      const t = targets[i];
      if (t) t.value = String(v);
    });
    saveSettings({
      passAccuracy: DEFAULT_CRITERIA.passAccuracy,
      cpmTargets: [...DEFAULT_CRITERIA.cpmTargets],
    });
    criteriaMsg.textContent = 'Вернули значения по умолчанию.';
    criteriaMsg.className = 'form-msg';
  }

  for (const input of [accuracy, ...targets]) {
    input.addEventListener('input', () => (criteriaMsg.textContent = ''));
  }

  const criteriaForm = h(
    'form',
    { class: 'settings-block', on: { submit: saveCriteria } },
    h('h2', { class: 'subtitle', text: 'Прохождение упражнений' }),
    h('p', {
      class: 'hint',
      text: 'Упражнение засчитывается, если точность и скорость не ниже этих значений.',
    }),
    h(
      'div',
      { class: 'fields' },
      field('Точность', accuracy, '%'),
      ...targets.map((t, i) => field(BANDS[i] ?? '', t, 'зн/мин')),
    ),
    criteriaMsg,
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn primary', text: 'Сохранить критерии', attrs: { type: 'submit' } }),
      h('button', {
        class: 'btn',
        text: 'Вернуть по умолчанию',
        attrs: { type: 'button' },
        on: { click: restoreDefaults },
      }),
    ),
  );

  // ---- Appearance ----
  const themeGroup = h(
    'div',
    { class: 'segment', attrs: { role: 'radiogroup', 'aria-label': 'Тема' } },
    ...THEMES.map((t) =>
      h('button', {
        class: 'seg-btn',
        text: t.label,
        attrs: {
          type: 'button',
          role: 'radio',
          'aria-checked': String(s.theme === t.value),
        },
        on: {
          click: () => {
            saveSettings({ theme: t.value });
            applyTheme(t.value);
            for (const b of themeGroup.children) {
              b.setAttribute('aria-checked', String(b.textContent === t.label));
            }
          },
        },
      }),
    ),
  );

  const appearance = h(
    'section',
    { class: 'settings-block' },
    h('h2', { class: 'subtitle', text: 'Вид' }),
    checkbox('Показывать клавиатуру в уроках', s.showKeyboard, (on) =>
      saveSettings({ showKeyboard: on }),
    ),
    h('p', { class: 'field-label', text: 'Тема' }),
    themeGroup,
  );

  // ---- Reset ----
  const resetMsg = h('p', { class: 'form-msg', attrs: { role: 'status' } });
  const dialog = h(
    'dialog',
    { class: 'confirm', attrs: { 'aria-labelledby': 'reset-title' } },
    h('h2', { class: 'subtitle', text: 'Сбросить весь прогресс?', attrs: { id: 'reset-title' } }),
    h('p', {
      text: 'Курс начнётся с этапа 1, история, статистика клавиш и рекорды удалятся. Настройки останутся.',
    }),
    h(
      'form',
      { class: 'actions', attrs: { method: 'dialog' } },
      h('button', { class: 'btn primary', text: 'Сбросить', attrs: { value: 'reset' } }),
      h('button', { class: 'btn', text: 'Отмена', attrs: { value: 'cancel' } }),
    ),
  );
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'reset') return;
    commit(resetProgress(store.data));
    store.failures.clear();
    resetMsg.textContent = 'Прогресс сброшен.';
  });

  const reset = h(
    'section',
    { class: 'settings-block' },
    h('h2', { class: 'subtitle', text: 'Прогресс' }),
    h('p', { class: 'hint', text: 'Удаляет пройденные этапы, историю занятий и рекорды.' }),
    h(
      'p',
      { class: 'actions' },
      h('button', {
        class: 'btn',
        text: 'Сбросить прогресс',
        attrs: { type: 'button' },
        on: { click: () => dialog.showModal() },
      }),
    ),
    resetMsg,
    dialog,
  );

  // ---- Dev only ----
  const dev = import.meta.env.DEV
    ? h(
        'section',
        { class: 'settings-block' },
        h('h2', { class: 'subtitle', text: 'Для разработки' }),
        checkbox('Открыть тест скорости без прохождения курса', s.devUnlock, (on) =>
          saveSettings({ devUnlock: on }),
        ),
      )
    : null;

  // ---- Sources ----
  const link = (text: string, href: string) =>
    h('a', { text, attrs: { href, target: '_blank', rel: 'noopener' } });
  const sources = h(
    'section',
    { class: 'settings-block sources' },
    h('h2', { class: 'subtitle', text: 'Источники и лицензии' }),
    h(
      'ul',
      {},
      h(
        'li',
        {},
        'Частотный словарь: ',
        link('Hermit Dave, FrequencyWords', 'https://github.com/hermitdave/FrequencyWords'),
        ' (по субтитрам OpenSubtitles), лицензия ',
        link('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'),
        '. Список отфильтрован для уроков.',
      ),
      h(
        'li',
        {},
        'Тексты для теста: А. П. Чехов, А. С. Пушкин, Л. Н. Толстой, ',
        link('Викитека', 'https://ru.wikisource.org'),
        ', общественное достояние.',
      ),
      h(
        'li',
        {},
        'Шрифты Oswald, Golos Text и JetBrains Mono, лицензия ',
        link('SIL Open Font License', 'https://openfontlicense.org'),
        '.',
      ),
    ),
  );

  return {
    el: h(
      'section',
      { class: 'page settings' },
      h('h1', { class: 'title', text: 'Настройки' }),
      criteriaForm,
      appearance,
      reset,
      dev,
      sources,
    ),
  };
}
