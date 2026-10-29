# Typing Trainer

Russian touch-typing trainer for the macOS Russian (ISO) layout. Static site, no backend.

**The source of truth is [SPEC.md](SPEC.md).** Read it before starting any work; follow its phase plan (§11) and confirm a short plan with the user at the start of each phase.

## Commands

- `npm run dev` — dev server
- `npm run check` — typecheck + lint + format check + unit tests; **must pass before every commit**
- `npm run test` / `npm run test:watch` — Vitest unit tests (`tests/`)
- `npm run e2e` — Playwright e2e (`e2e/`), builds and serves `dist/` on port 4173
- `npm run e2e:live` — the same e2e suite against https://ablindspot.netlify.app
- `npm run build` — production build to `dist/`
- `npm run format` — Prettier write

## Conventions

- Vite + TypeScript strict, no UI framework, no runtime dependencies unless clearly justified.
- All interface text is in Russian.
- `src/engine/`, `src/textgen/`, `src/curriculum/` never touch the DOM; write them test-first.
- Layout and curriculum are data (`src/layouts/ru-mac-iso.ts`, `src/curriculum/ru.ts`), not code.
- Colours, fonts and spacing only via CSS custom properties in `src/styles/tokens.css`.
- Small commits with clear messages.

## Deployment

Netlify builds every push to `main` of github.com/gentlemanjck/blindspot (`netlify.toml`: `npm run check && npm run build`, publish `dist`). Branches get preview URLs. Git identity for this repo is the GitHub noreply address; pushes go over SSH.

## Environment notes

- The dev Mac runs macOS 13. `@playwright/test` is pinned to **1.61.1**, the last release that ships Chromium for macOS 13. Do not upgrade it unless the OS is upgraded.
- TypeScript is on **6.0** because `typescript-eslint` does not support TypeScript 7 yet.
- Two tsconfigs: `tsconfig.json` (browser: `src`, `tests`) and `tsconfig.node.json` (configs, `e2e`).
