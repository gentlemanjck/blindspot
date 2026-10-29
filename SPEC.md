# Typing Trainer — Technical Specification

Oct 29, 2026 · @Grigorii Vetrov

## 1. Overview and goals

Build a browser-based Russian touch-typing trainer: structured lessons that teach blind typing from two letters up to full sentences, followed by an unlocked speed test. The product is a static website with no backend and no accounts; all progress lives in the browser.

Goals:

- Teach touch typing on the **macOS Russian (ISO)** layout from zero, starting from the home row and the most frequent letters.
- After the full lesson course, offer a speed test (Monkeytype-style) to keep improving speed and accuracy.
- Clean, distraction-free typing experience with instant feedback.
- Ship it publicly on the internet as a learning exercise in deployment.

Non-goals for now: user accounts, leaderboards, multiplayer, mobile typing, English layout.

The visual design concept was chosen in phase 5 (see section 7, "Visual design"); phase 9 refines it. All design values stay in CSS variables so the design can change without touching logic.

## 2. Scope: MVP vs later

| Feature | MVP | Later |
| --- | --- | --- |
| Russian layout, macOS ISO variant | Yes | Russian – PC, English QWERTY |
| Lesson course (stages, unlock by criteria) | Yes | Adaptive drills on weak keys (keybr-style) |
| Speed test, unlocked after the course | Yes | Custom user text, quotes mode |
| On-screen keyboard with finger zones and next-key hint | Yes | Hand diagram |
| Live stats (CPM, accuracy, timer) and result screen | Yes | Speed-over-time graph per attempt |
| Progress page | History table + per-key accuracy | Keyboard heatmap, trend charts |
| Progress saved in localStorage | Yes | Export/import JSON |
| Light and dark theme | Neutral theme via CSS variables | Full design from the design step |
| Sound on keypress | No | Optional toggle |
| Accounts, leaderboards | No | Requires a backend |

## 3. Keyboard layout: macOS Russian (ISO)

The only layout in the MVP is the standard macOS input source **“Russian”** (not “Russian – PC”, not “Phonetic”) on an **ISO** physical keyboard: short left Shift with an extra key between it and Я, tall Enter.

Key facts that differ from the Windows/PC layout:

- Period is **Shift+7**, comma is **Shift+6** (on PC they share the bottom-right key).
- Other shifted digits: Shift+1 `!`, Shift+2 `"`, Shift+3 `№`, Shift+4 `%`, Shift+5 `:`, Shift+8 `;`, Shift+9 `(`, Shift+0 `)`.
- **ё/Ё is the key left of Enter** (home row, after Э; `event.code = Backslash`), typed with the right pinky.
- `/` and `?` share the bottom-right key (`Slash`): `/` plain, `?` with Shift.
- The two ISO-specific keys carry no letters: top-left key `>` / `<`, extra key next to left Shift `]` / `[`. The browser reports their codes swapped: top-left is `IntlBackslash`, the key next to left Shift is `Backquote`.
- `«` `»` are not on the base or Shift layer (Option+`=` gives `»`).

Confirmed in phase 2 by a capture on the user's Mac (`src/layouts/capture/ru-mac-iso.json`).

**Implementation rule:** store the layout as data, not code — one file `src/layouts/ru-mac-iso.ts` mapping each physical key (`KeyboardEvent.code`) to `{ normal, shift, finger, row }`. The on-screen keyboard is rendered from this map.

**Verify before coding the map:** open a tiny debug page on the user’s Mac that logs `event.code`, `event.key` and `event.shiftKey` for every keypress, and fill the map from real output — especially the positions of ё/Ё, `/`, `?`, and the two ISO-specific keys. Do not rely on memory for these.

Finger zones (standard ЙЦУКЕН touch typing, home row ФЫВА — ОЛДЖ, index fingers on А and О):

| Finger | Keys |
| --- | --- |
| Left pinky | Й Ф Я, 1, top-left key, ISO key next to left Shift, left Shift |
| Left ring | Ц Ы Ч, 2 |
| Left middle | У В С, 3 |
| Left index | К Е А П М И, 4, 5 |
| Right index | Н Г Р О Т Ь, 6, 7 |
| Right middle | Ш Л Б, 8 |
| Right ring | Щ Д Ю, 9 |
| Right pinky | З Х Ъ Ж Э Ё, /, 0, -, =, right Shift, Enter |
| Thumbs | Space |

Shift rule taught in lessons: capital letters use the Shift on the opposite hand.

If the user types with a non-Russian input source active (Latin characters arrive), show a non-blocking banner: “Switch to the Russian keyboard layout” and do not count those keystrokes as errors.

## 4. Lessons mode: curriculum and progression

The course is a fixed sequence of **stages**. Each stage adds 2–4 new keys, starting from the home row centre and the most frequent Russian letters, then expanding outward by finger and row. Space is available from stage 1.

Starting curriculum (store it as data in `src/curriculum/ru.ts` so it is easy to reorder):

| Stage | New keys | Why |
| --- | --- | --- |
| 1 | А О | Index fingers, home position, very frequent |
| 2 | В Л | Middle fingers, home row |
| 3 | Ы Д | Ring fingers, home row |
| 4 | П Р | Index fingers reach inward, home row |
| 5 | Е Н | Index fingers, top row, very frequent |
| 6 | К Г | Index fingers, top row |
| 7 | М Т | Index fingers, bottom row |
| 8 | И Ь | Index fingers, bottom row inward |
| 9 | У Ш | Middle fingers, top row |
| 10 | С Б | Middle fingers, bottom row |
| 11 | Ф Ж Э | Pinkies, home row |
| 12 | Ц Щ | Ring fingers, top row |
| 13 | Ч Ю | Ring fingers, bottom row |
| 14 | Й З Х Ъ | Pinkies, top row |
| 15 | Я Ё | Left pinky bottom row; right pinky home row, left of Enter |
| 16 | Shift + capitals | Opposite-hand Shift |
| 17 | Period, comma (Shift+7, Shift+6) | Sentence punctuation |
| 18 | ! ? : ; - " | Remaining punctuation (straight quotes `"` on Shift+2 instead of «», which need Option) |
| 19 | Digits 0–9 | Optional final stage |

Each stage contains **4 exercise types**, in order. Each exercise is about 1 line (40–60 characters):

1. **Keys** — the new keys alone and in pairs: `аоа оао аа оо`.
2. **Combinations** — syllables mixing new and learned keys, new keys weighted \~50%.
3. **Words** — real words built only from unlocked letters, taken from a frequency word list, preferring words that contain the new letters.
4. **Phrases** — short sequences of those words; from stage 16 on, real sentences with capitals, and punctuation added only as it is unlocked (stage 16: capitals, no punctuation; stage 17: plus period and comma; stage 18: plus the rest).

If an early stage has too few real words, skip type 3 and 4 or use pseudo-words; never show a word that contains a locked letter. (With the current word list, stages 1–2 have only Keys and Combinations; a stage needs at least 12 multi-letter words.)

**Unlock rule:** any character — letter, capital, punctuation mark or digit — appears in lesson text only after the stage that introduces it is fully completed, or within that stage itself. This applies to every exercise type.

**Pass criteria** for each exercise (configurable in Settings):

- Accuracy ≥ 95%.
- Speed ≥ a target CPM that rises with the course: 60 CPM for stages 1–5, 100 for 6–10, 140 for 11–15, 160 after.
- A failed exercise is repeated with freshly generated text. After 3 failures, show a hint (“slow down, focus on accuracy”), never block.

A stage is complete when all its exercises are passed; the next stage unlocks. The user can replay any completed stage. Completing the last letter stage (15) plus stages 16–17 marks the **course as complete** and unlocks the speed test.

Text generation must be **deterministic given a seed** so it can be unit-tested.

## 5. Speed test mode

The speed test is locked until the course is complete; the lock screen shows remaining stages. A hidden dev flag (`?unlock=1` in the URL or a Settings toggle in dev builds) unlocks it for testing.

Options (persisted between sessions):

- **Length:** by time (15, 30, 60, 120 s) or by words (25, 50, 100).
- **Text source:** random words from the top-1000 frequency list (default), or passages from public-domain Russian classics.
- **Toggles:** capitals, punctuation, ё vs е (accept either when off).

Behaviour differs from lessons:

- Errors do not block: the wrong character is shown in red and the cursor moves on (Monkeytype-style).
- Backspace fixes errors within the current word; it cannot go back past a completed word.
- Restart instantly with Tab or Esc; a new text is generated.

The result screen shows CPM, accuracy, raw CPM (including errors), error count, and the 3 slowest/most-missed keys of this attempt. The best result per configuration is stored as a personal record.

## 6. Typing engine and metrics

One shared, UI-independent engine (`src/engine/`) runs both modes. It receives keystrokes and the target text and emits state; it never touches the DOM, so it is fully unit-testable.

Input handling:

- Listen to `keydown` on `document`. Compare `event.key` (the produced character) with the expected character. To highlight the pressed key on the on-screen keyboard, look up `event.key` in the layout first and fall back to `event.code` (codes of the two ISO keys differ between browsers).
- Ignore pure modifier presses (Shift, Cmd, Option, Ctrl, CapsLock) and any key with Cmd/Ctrl held, so browser shortcuts keep working.
- `preventDefault` on Space and printable keys while a session is active (stops page scrolling).
- Timer starts on the first keystroke, not on page load. Pause when the tab loses focus; show “click to continue”.

Error modes:

- **Lessons:** stop-on-error. The cursor does not advance until the correct key is pressed; every wrong keystroke counts as an error (three wrong presses on one position = three errors in accuracy).
- **Test:** described in section 5.

Metrics (Russian convention: characters per minute):

| Metric | Definition |
| --- | --- |
| CPM (зн/мин) | Correct characters ÷ elapsed minutes. Main speed figure. |
| Raw CPM | All typed characters ÷ elapsed minutes. |
| WPM | CPM ÷ 5; shown as secondary only. |
| Accuracy | Correct keystrokes ÷ all keystrokes × 100%; every wrong keystroke counts, including repeated misses on the same position and corrected errors. |
| Per-key stats | For each expected character: hits, misses, mean time from previous keystroke (ms). |

Live stats update at most every 250 ms to keep rendering cheap; final numbers are computed from the full keystroke log at the end.

## 7. UI and screens

All interface text is in Russian. Desktop-first (min width 1024 px); on narrow screens show a message that a physical keyboard is required.

| Screen | Route | Contents |
| --- | --- | --- |
| Home / course map | `#/` | List of stages with status (locked, current, done), best CPM and accuracy per stage, “Continue” button, speed test entry (locked or open). |
| Lesson | `#/lesson/:stage/:exercise` | Text line, live stats, on-screen keyboard, stage progress (exercise 2 of 4). |
| Lesson result | overlay on lesson | CPM, accuracy, pass/fail vs criteria, problem keys, buttons: Retry / Next. |
| Speed test | `#/test` | Mode bar (time/words, options), text, live stats; keyboard hidden by default. |
| Test result | overlay on test | Figures from section 5, personal record badge, Restart. |
| Progress | `#/stats` | History table (date, mode, CPM, accuracy), per-key accuracy table. |
| Settings | `#/settings` | Pass criteria, show/hide keyboard, theme, reset progress (with confirm), data sources and licences (word list attribution, CC BY-SA 4.0). |

Typing area behaviour:

- Monospace font, large size; 1–3 lines visible, auto-scrolling by line.
- Text still to type in pencil grey, typed text in ink, current character boxed, errors in red (a fixed mistake stays underlined in red).
- On-screen keyboard: keys tinted by finger zone, the next expected key highlighted, the Shift to use highlighted for capitals, the last pressed key flashes (green correct / red wrong).
- Focus mode: header and nav fade out while typing; they return on mouse move or Esc.

**Visual design: Russian constructivism.** A 1920s poster in red (`#E1251B`), black and newsprint grey; the dark theme is the reversed poster (black sheet, light ink, brighter red). Hard edges, no rounded corners, figures on solid red and black blocks, one diagonal per screen. Details: a red band across the course headline crossing a black circle; a giant outlined stage number behind the lesson; a red Lissitzky wedge under the text that grows with progress; the timer in a ring; the result as a poster with the remark on a diagonal band. Exercise text is large (46 px JetBrains Mono Bold): typed in black, upcoming in grey, the current character on a red block (black block while wrong), mistakes stay red. Finger zones on the keyboard are four grey tones per hand, hatched in opposite directions for left and right; the next key is solid red. Fonts (self-hosted via `@fontsource`): Oswald for headlines and figures, Golos Text for the interface, JetBrains Mono for exercise text and keys.

Use hash-based routing so every route works on static hosting without server rewrites. Keep all colours, fonts and spacing in CSS custom properties (`src/styles/tokens.css`) so the design step only edits tokens and component styles.

## 8. Persistence

All data is stored in `localStorage` under one key, `typing-trainer:v1`, as a single JSON object. Nothing leaves the browser.

```
{
  schemaVersion: 1,
  settings: { showKeyboard, theme, passAccuracy, cpmTargets, test: { lengthType, length, source, capitals, punctuation, yoOptional } },
  course: { stages: { [stageId]: { status, exercisesPassed[], bestCpm, bestAccuracy } }, completedAt? },
  keyStats: { [char]: { hits, misses, totalMs, timedHits } },  // mean time = totalMs / timedHits (the first keystroke of a session has no timing)
  history: [ { at, mode, stageId?, exerciseType?, cpm, rawCpm, accuracy, durationMs, config? } ],  // keep last 500
  records: { [testConfigKey]: { cpm, accuracy, at } }
}
```

Rules:

- Wrap every read/write in try/catch; if storage is unavailable or corrupt, the app still works and shows a small warning that progress will not be saved.
- Write after each finished exercise or test, never on every keystroke.
- `schemaVersion` plus a `migrate()` function from day one, so later changes do not wipe progress.
- Settings has “Reset progress” with a confirmation dialog.

## 9. Tech stack, structure, tooling

**Stack:** Vite + TypeScript (strict), no UI framework. Plain DOM with small render functions is enough for this app and keeps keystroke latency minimal. Vitest for unit tests, Playwright for end-to-end tests, ESLint + Prettier. No runtime dependencies unless clearly justified.

Development machine: macOS, Claude Code in VS Code. Use the project’s own `npm` scripts; Node LTS.

Proposed structure:

```
src/
  main.ts              // bootstrap, router
  router.ts            // hash routing
  engine/              // typing session, metrics (no DOM)
  layouts/ru-mac-iso.ts
  curriculum/ru.ts     // stages + pass criteria
  textgen/             // seeded generators: keys, syllables, words, phrases
  data/                // word frequency list, public-domain passages
  storage/             // load/save/migrate
  ui/                  // screens and components (keyboard, text line, stats)
  styles/tokens.css    // design tokens (colours, fonts, spacing)
tests/                 // Vitest unit tests
e2e/                   // Playwright tests
```

Text data:

- A Russian word frequency list with a licence that allows redistribution; record the source and licence in `src/data/README.md`. Check the licence before adding.
- Sentences for later stages and the test: passages from authors whose works are in the public domain (e.g. Pushkin, Chekhov, Tolstoy), normalised to the allowed character set (e.g. «» and „“ → `"`, — and – → `-`). Record each source.

Claude Code skills to use:

| Skill | Source | When |
| --- | --- | --- |
| superpowers (brainstorming, writing-plans, TDD, verification) | `obra/superpowers` | Planning each phase; test-first for engine, curriculum, textgen |
| webapp-testing | `anthropics/skills` | Playwright checks that typing, metrics and unlocks work in a real browser |
| frontend-design | `anthropics/skills` | The separate design step only |
| web-design-guidelines | `vercel-labs/agent-skills` | Final UI/accessibility review |

Conventions: small commits with clear messages; `npm run check` runs typecheck, lint and unit tests and must pass before each commit.

## 10. Deployment

The build stays a plain static `dist/` folder so it can move to any static host.

Chosen in phase 10: **GitHub Pages** from the public repository `gentlemanjck/blindspot`. Live at **https://gentlemanjck.github.io/blindspot/**; `npm run e2e:live` runs the e2e suite against it. (Netlify was tried first and dropped: its free tier injects a "powered by Netlify" badge that cannot be hidden.)

1. Public GitHub repository; code under MIT, data under its own licences (`LICENSE`, `src/data/README.md`).
2. Pages source is **GitHub Actions**. `.github/workflows/deploy.yml` (from the Vite static-deploy guide) runs `npm ci`, `npm run check`, `npm run build` with Node from `.nvmrc`, uploads `dist` and deploys it on every push to `main`. A failing check stops the deploy.
3. `base` in `vite.config.ts` stays `./` (relative assets), so the same build works under `/blindspot/` and on a custom domain later; e2e tests use relative URLs for the same reason.

If users cannot open github.io reliably, fallbacks are a Russian static host or Yandex Object Storage with a custom domain.

Reference: [Vite — Deploying a Static Site](https://vite.dev/guide/static-deploy).

## 11. Work plan and acceptance criteria

Work in phases; finish and verify each phase before starting the next. At the start of each phase, write a short plan and confirm it with the user.

1. **Setup:** Vite + TS project, lint, tests, `npm run check`, git repo, `CLAUDE.md` pointing to this spec.
2. **Layout:** key-logging debug page, fill `ru-mac-iso.ts` from real keypresses on the user’s Mac.
3. **Engine:** typing session, error modes, metrics, with unit tests.
4. **Lessons:** curriculum data, seeded text generators, pass criteria, unlocking, with unit tests.
5. **UI (neutral):** router, course map, lesson screen, on-screen keyboard, result overlay.
6. **Persistence:** storage, migration, reset.
7. **Speed test:** options, test screen, results, records, lock until course complete.
8. **Progress and settings screens.**
9. **Design refinement** (frontend-design skill): polish the notebook design chosen in phase 5.
10. **Deploy:** GitHub Pages workflow, public URL.

Acceptance criteria for the MVP:

- [x] Every character of the macOS Russian ISO layout typed on the user’s Mac is recognised correctly, including ё, period (Shift+7) and comma (Shift+6).
- [x] Lesson text never contains a locked character.
- [x] A stage unlocks only after its exercises meet accuracy and CPM targets; progress survives a page reload.
- [x] CPM and accuracy match a hand-calculated example in unit tests.
- [x] The speed test is locked until the course is complete, and the dev unlock works.
- [x] Typing feels instant: no visible lag at 600 CPM. (checked by the user on a real keyboard; not measured)
- [x] Latin input shows the “switch layout” banner and is not counted as errors.
- [x] App works with localStorage disabled (no crash, warning shown).
- [x] Playwright e2e: complete stage 1 by typing, see stage 2 unlock; run a 15 s test and see a result.
- [x] Production build deploys and opens at the public URL. (https://gentlemanjck.github.io/blindspot/, e2e suite passes there)

Open questions:

- ~~Exact positions of ё/Ё and the ISO extra keys~~ — confirmed in phase 2, see section 3.
- ~~Which word frequency list to use~~ — hermitdave/FrequencyWords (CC BY-SA 4.0), chosen in phase 4; see `src/data/README.md`. Attribution must be shown in the app (Settings).
- ~~Final hosting choice~~ — GitHub Pages (phase 10). A custom domain is still optional.
