# Repository Guidelines

## Project Structure & Module Organization
- `electron/main/` contains session monitors, IPC handlers, and startup logic—treat it as the backend boundary.
- `src/` stores the React renderer; keep UI pieces in `src/components/`, shared helpers in `src/utils/`, and types in `src/types/`.
- Automation hooks for Claude live in `hooks/`; extend scripts alongside `hooks/utils/` helpers so the CLI and desktop flows stay in sync.
- Codex monitoring is handled by `electron/main/codexMonitor.ts`, which watches `~/.codex/sessions/**/rollout-*.jsonl`—keep parsing logic pure enough to unit test.
- Tests reside in `tests/`; build artifacts land in `dist/` and `dist-electron/`—never edit generated files directly.

## Build, Test, and Development Commands
- `npm run dev` starts Vite and Electron together via `concurrently` for local iterations.
- `npm run dev:web` runs only the Vite renderer, useful when mocking IPC during UI prototyping.
- `npm run electron` boots Electron against the output in `dist-electron/` after a prior build.
- `npm run build` runs TypeScript checks, builds the renderer, then packages the app with `electron-builder` into `dist/`.
- `npm run setup` installs the monitoring hooks; rerun after cloning or changing hook behavior.

## Coding Style & Naming Conventions
- Use TypeScript everywhere; React components stay as `PascalCase` in `.tsx`, hooks/handlers as `camelCase`, and enums from `src/types/session.ts` instead of string literals.
- Follow the existing two-space indentation, trailing commas in multiline structures, and group imports Framework → Local.
- Keep side effects (logging, IPC) inside React effects or dedicated helpers to preserve pure render functions.

## Testing Guidelines
- Jest + React Testing Library patterns live under `tests/`; mirror filenames like `SessionCard.test.tsx` when adding coverage.
- Run the suite with `npx jest --runInBand`; add a `test` script to `package.json` if you expand automated usage.
- Mock Tauri IPC through `@tauri-apps/api/core` stubs and assert user-visible outcomes (ARIA labels, timers) rather than implementation details.
- Cover new pathways in Electron handlers and renderer components before opening a PR; include regression tests for session lifecycle bugs.
- When working on Codex monitoring, craft fixtures under a temp `~/.codex/sessions` tree rather than hitting live Codex; helpers in `codexMonitor.ts` accept plain JSON so you can unit test parsing.

## Commit & Pull Request Guidelines
- Follow the imperative, concise style seen in history (e.g., `Add Hide Session functionality`); keep subjects under ~72 characters.
- Group related work per commit (Electron, renderer, tests) and update `AGENTS.md` or other docs when behavior changes; if `PRD.md`, `PLANING.md`, or `TASKS.md` exist, refresh them too.
- PRs should include a short summary, testing commands run, screenshots/GIFs for UI updates, and links to tracked issues or tasks.
- Prefer `feature/<slug>` or `fix/<slug>` branches and rebase to incorporate upstream changes instead of merge commits.
