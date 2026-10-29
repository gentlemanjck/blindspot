// Guided capture of the physical keyboard (SPEC §3, phase 2). Dev only, not part of the build.
// Walks every physical position three times (plain, Shift, Option) and records what the
// browser reports, so ru-mac-iso.ts is filled from real data rather than memory.
import '../src/styles/tokens.css';

type Layer = 'normal' | 'shift' | 'option';

interface Position {
  id: string;
  row: number;
  col: number;
  /** Faint label for orientation only; letter positions of ЙЦУКЕН are certain. */
  hint: string;
}

interface Captured {
  code: string;
  key: string;
}

const LAYERS: Layer[] = ['normal', 'shift', 'option'];
const LAYER_NAMES: Record<Layer, string> = {
  normal: 'без модификаторов',
  shift: 'с Shift',
  option: 'с Option',
};

// Mac ISO: 13 keys in the digit row, 12 in the top and home rows, 11 in the bottom row.
const HINTS = [
  ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '', ''],
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э', ''],
  ['', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', ''],
];
const LEFT_MODS = ['', 'Tab', 'Caps', 'Shift'];
const RIGHT_MODS = ['⌫', '', 'Enter', 'Shift'];

const positions: Position[] = HINTS.flatMap((row, r) =>
  row.map((hint, c) => ({ id: `r${r}c${c}`, row: r, col: c, hint })),
);

const captures: Record<Layer, Map<string, Captured>> = {
  normal: new Map(),
  shift: new Map(),
  option: new Map(),
};
/** Order of presses, for undo. */
const history: { layer: Layer; id: string; skipped: boolean }[] = [];
let layerIndex = 0;
let posIndex = 0;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const kbd = el<HTMLDivElement>('kbd');
const prompt = el<HTMLDivElement>('prompt');
const warn = el<HTMLDivElement>('warn');
const log = el<HTMLTableSectionElement>('log');
const saveBtn = el<HTMLButtonElement>('save');
const status = el<HTMLSpanElement>('status');

function isFinished(): boolean {
  return layerIndex >= LAYERS.length;
}

function currentLayer(): Layer | undefined {
  return LAYERS[layerIndex];
}

function render(): void {
  kbd.innerHTML = '';
  const current = positions[posIndex];
  HINTS.forEach((row, r) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    if (LEFT_MODS[r]) rowEl.append(modKey(LEFT_MODS[r]));
    row.forEach((_, c) => {
      const pos = positions.find((p) => p.row === r && p.col === c);
      if (!pos) return;
      const keyEl = document.createElement('div');
      keyEl.className = 'key';
      if (!isFinished() && current?.id === pos.id) keyEl.classList.add('current');
      const n = captures.normal.get(pos.id);
      const s = captures.shift.get(pos.id);
      const o = captures.option.get(pos.id);
      if (n && s && o) keyEl.classList.add('done');
      keyEl.innerHTML =
        `<span>${esc(n?.key ?? '')}</span>` +
        `<span class="layer-shift">${esc(s?.key ?? '')}</span>` +
        `<span class="layer-option">${esc(o?.key ?? '')}</span>` +
        `<span class="hint">${esc(pos.hint)}</span>`;
      keyEl.title = n?.code ?? '';
      rowEl.append(keyEl);
    });
    if (RIGHT_MODS[r]) rowEl.append(modKey(RIGHT_MODS[r]));
    kbd.append(rowEl);
  });

  const layer = currentLayer();
  if (!layer) {
    prompt.textContent = 'Готово. Нажмите «Сохранить».';
  } else {
    prompt.innerHTML = `Проход ${layerIndex + 1} из 3 — <b>${LAYER_NAMES[layer]}</b>. Клавиша ${posIndex + 1} из ${positions.length}.`;
  }
  saveBtn.disabled = history.length === 0;
}

function modKey(label: string): HTMLDivElement {
  const k = document.createElement('div');
  k.className = 'key mod';
  k.textContent = label;
  return k;
}

function esc(s: string): string {
  const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', ' ': '␣' };
  return s.replace(/[<>& ]/g, (ch) => map[ch] ?? ch);
}

function addLogRow(e: KeyboardEvent, posId: string): void {
  const tr = document.createElement('tr');
  for (const v of [posId, e.code, e.key, String(e.shiftKey), String(e.altKey)]) {
    const td = document.createElement('td');
    td.textContent = v;
    tr.append(td);
  }
  log.prepend(tr);
}

function advance(): void {
  posIndex++;
  if (posIndex >= positions.length) {
    posIndex = 0;
    layerIndex++;
  }
}

function undo(): void {
  const last = history.pop();
  if (!last) return;
  captures[last.layer].delete(last.id);
  layerIndex = LAYERS.indexOf(last.layer);
  posIndex = positions.findIndex((p) => p.id === last.id);
  log.firstElementChild?.remove();
}

const MODIFIERS = new Set(['Shift', 'Alt', 'Meta', 'Control', 'CapsLock', 'Fn']);

document.addEventListener('keydown', (e) => {
  if (MODIFIERS.has(e.key) || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  warn.textContent = '';

  if (e.key === 'Backspace') {
    undo();
    render();
    return;
  }
  const layer = currentLayer();
  const pos = positions[posIndex];
  if (!layer || !pos) return;

  if (e.key === 'Enter') {
    history.push({ layer, id: pos.id, skipped: true });
    advance();
    render();
    return;
  }

  const wantShift = layer === 'shift';
  const wantAlt = layer === 'option';
  if (e.shiftKey !== wantShift || e.altKey !== wantAlt) {
    warn.textContent = `Нужен проход «${LAYER_NAMES[layer]}». Нажатие не записано.`;
    return;
  }
  if (layer === 'normal' && /^[a-z]$/i.test(e.key)) {
    warn.textContent =
      'Пришла латинская буква — включите раскладку «Русская». Нажатие не записано.';
    return;
  }
  const dup = [...captures[layer].entries()].find(([, v]) => v.code === e.code);
  if (dup) {
    warn.textContent = `Эта физическая клавиша (${e.code}) уже записана в позиции ${dup[0]}. Проверьте и при необходимости отмените (Backspace).`;
  }

  captures[layer].set(pos.id, { code: e.code, key: e.key });
  history.push({ layer, id: pos.id, skipped: false });
  addLogRow(e, pos.id);
  advance();
  render();
});

saveBtn.addEventListener('click', async () => {
  const keys = positions.map((p) => ({
    position: p.id,
    row: p.row,
    col: p.col,
    code: captures.normal.get(p.id)?.code ?? captures.shift.get(p.id)?.code ?? null,
    normal: captures.normal.get(p.id)?.key ?? null,
    shift: captures.shift.get(p.id)?.key ?? null,
    option: captures.option.get(p.id)?.key ?? null,
    codeMismatch: new Set(LAYERS.map((l) => captures[l].get(p.id)?.code).filter(Boolean)).size > 1,
  }));
  const body = JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      complete: isFinished(),
      keys,
    },
    null,
    2,
  );
  status.textContent = 'Сохраняю…';
  try {
    const res = await fetch('/__save-layout-capture', { method: 'POST', body });
    status.textContent = res.ok ? `Сохранено: ${await res.text()}` : `Ошибка ${res.status}`;
  } catch (err) {
    status.textContent = `Ошибка: ${String(err)}`;
  }
  saveBtn.blur();
});

el<HTMLButtonElement>('restart').addEventListener('click', (e) => {
  for (const l of LAYERS) captures[l].clear();
  history.length = 0;
  layerIndex = 0;
  posIndex = 0;
  log.innerHTML = '';
  status.textContent = '';
  (e.currentTarget as HTMLButtonElement).blur();
  render();
});

render();
