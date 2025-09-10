# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (components, hooks, services, utils, reducers, actions, contexts, types, config).
- Tests: `src/__tests__/unit`, `src/__tests__/components` (Jest) and `src/__tests__/e2e` (Playwright `.spec.ts`).
- Public assets: `public/`. Build output: `build/`.
- Feature flags: `src/config/features.ts` (localStorage-backed, dev-only debug interface on `window.timelineFeatureFlags`).

## Build, Test, and Development Commands
- `npm start`: Runs the CRA dev server at `http://localhost:3000`.
- `npm run build`: Production build into `build/`.
- `npm test`: Jest in watch mode.
- `npm run test:unit`: Jest once (no watch) for CI/local checks.
- `npm run test:e2e`: Playwright E2E suite (auto-starts the dev server per `playwright.config.ts`).
- `npm run test:all`: Runs unit then E2E suites.

## Coding Style & Naming Conventions
- Language: React 18 with JS/TS; prefer new code in TypeScript (`.ts`/`.tsx`).
- Indentation: 2 spaces; single quotes; semicolons allowed but be consistent.
- Components: PascalCase files in `src/components/` (e.g., `ValidatedInput.tsx`).
- Hooks: `useXxx` in `src/hooks/` (camelCase files).
- Utilities/Services: `src/utils/` and `src/services/` with descriptive names; avoid one-letter vars.
- Linting: CRA ESLint defaults; keep JSX accessible and test-friendly.

## Testing Guidelines
- Frameworks: Jest + Testing Library for unit/component; Playwright for browser E2E.
- Unit test locations: `src/__tests__/unit` and `src/__tests__/components`; name `*.test.ts(x)`.
- E2E locations: `src/__tests__/e2e`; name `*.spec.ts`.
- Coverage: aim for meaningful coverage on core flows; run `npm run test:unit -- --coverage`.

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (`feat:`, `fix:`, `chore:`). History mixes types and imperative subjects; align on concise, present-tense messages.
- PRs: Include clear description, linked issues, and screenshots/GIFs for UI changes. Note any feature flags touched and default states. Ensure `npm run test:all` passes.

## Security & Configuration Tips
- Feature flags are persisted in localStorage and expose a dev-only debug interface; this is stripped in production via `NODE_ENV`. Do not rely on flags for security boundaries.
- Avoid checking secrets into the repo. Use environment variables via CRA conventions (prefix with `REACT_APP_`).
