// Lesson course (SPEC §4). Data only: reorder or edit stages here.

export type ExerciseType = 'keys' | 'combos' | 'words' | 'phrases';

export const EXERCISE_TYPES: readonly ExerciseType[] = ['keys', 'combos', 'words', 'phrases'];

/** Each exercise type is done this many times in a row, each time with fresh text. */
export const EXERCISE_REPEATS = 2;

/** What a stage teaches; decides how the text generators use the new characters. */
export type StageKind = 'letters' | 'capitals' | 'punctuation' | 'digits';

export interface Stage {
  id: number;
  kind: StageKind;
  /** Characters this stage introduces. */
  newChars: readonly string[];
  /** Short Russian label for the course map. */
  title: string;
  /** Index into PassCriteria.cpmTargets. */
  cpmBand: number;
}

export interface PassCriteria {
  /** Minimum accuracy, %. */
  passAccuracy: number;
  /** Minimum CPM per band: stages 1–5, 6–10, 11–15, 16+. */
  cpmTargets: readonly number[];
}

export const DEFAULT_CRITERIA: PassCriteria = {
  passAccuracy: 95,
  cpmTargets: [60, 100, 140, 160],
};

/** Stages 1–17 make the course complete and unlock the speed test (SPEC §4). */
export const COURSE_COMPLETE_STAGE = 17;

const UPPER = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

const letters = (id: number, chars: string, cpmBand: number): Stage => ({
  id,
  kind: 'letters',
  newChars: [...chars],
  title: [...chars.toUpperCase()].join(' '),
  cpmBand,
});

export const STAGES: readonly Stage[] = [
  letters(1, 'ао', 0),
  letters(2, 'вл', 0),
  letters(3, 'ыд', 0),
  letters(4, 'пр', 0),
  letters(5, 'ен', 0),
  letters(6, 'кг', 1),
  letters(7, 'мт', 1),
  letters(8, 'иь', 1),
  letters(9, 'уш', 1),
  letters(10, 'сб', 1),
  letters(11, 'фжэ', 2),
  letters(12, 'цщ', 2),
  letters(13, 'чю', 2),
  letters(14, 'йзхъ', 2),
  letters(15, 'яё', 2),
  { id: 16, kind: 'capitals', newChars: [...UPPER], title: 'Заглавные буквы', cpmBand: 3 },
  { id: 17, kind: 'punctuation', newChars: ['.', ','], title: 'Точка и запятая', cpmBand: 3 },
  {
    id: 18,
    kind: 'punctuation',
    newChars: ['!', '?', ':', ';', '-', '"'],
    title: 'Знаки препинания',
    cpmBand: 3,
  },
  { id: 19, kind: 'digits', newChars: [...'0123456789'], title: 'Цифры', cpmBand: 3 },
];

export function getStage(id: number): Stage {
  const stage = STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`Unknown stage ${id}`);
  return stage;
}

/** Every character allowed in the text of a stage: its own and all earlier ones, plus space. */
export function allowedChars(stageId: number): Set<string> {
  const set = new Set<string>([' ']);
  for (const stage of STAGES) {
    if (stage.id > stageId) break;
    for (const ch of stage.newChars) set.add(ch);
  }
  return set;
}

/** Lowercase letters unlocked by a stage. */
export function unlockedLetters(stageId: number): string[] {
  return STAGES.filter((s) => s.kind === 'letters' && s.id <= stageId).flatMap((s) => s.newChars);
}

export function cpmTarget(stage: Stage, criteria: PassCriteria): number {
  const targets = criteria.cpmTargets;
  return targets[Math.min(stage.cpmBand, targets.length - 1)] ?? 0;
}
