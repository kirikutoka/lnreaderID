# AGENTS.md

## Navigation pointers

- `CODING_STANDARDS.md` — coding, plugin, multisrc migration, and PR review standards (consult during review and before adding/migrating plugins).
- `package.json` — authoritative scripts (`lint`, `format:check`, `build:compile`, `build:full`, `dev:start`, `check:plugin`, `check:sites`).
- `README.md`, `docs/quickstart.md`, `docs/docs.md`, `docs/testing.md`, `docs/plugin-template.ts` — setup, plugin API, live checker, and starter template.

## Repository map

- This repository only includes sources serving Indonesian-language novels.
- `plugins/indonesian/*.ts`: standalone Indonesian plugins.
- `plugins/multisrc/<generator>/`: generator, template, `sources.json`, and custom assets for Indonesian sources (`plugins/indonesian/*[*].ts` are disposable generated outputs).
- `public/static/src/id/<plugin-id>/`: 96x96 PNG icons and custom assets for standalone Indonesian plugins.
- `public/static/multisrc/<generator>/`: assets used by the retained multisrc plugins.
- `src/types/plugin.ts`, `src/libs/`: canonical plugin interfaces and `@libs/*` runtime helpers.
- `src/`: React/Vite playground; `scripts/`: build, manifest, publishing, and live-check tooling.
- `BLACKLIST.json`: disallowed sources.

## Environment & package management

- Use Node.js 22+ locally (CI runs Node 20 and 24).
- Repo docs and CI use `npm` / `npm ci`; keep `package-lock.json` untouched unless dependencies change.
- Copy `.env.template` to `.env` only for local manifest serving; keep `.env` uncommitted.

## Key gotchas

- **Hermes runtime**: Plugins compile for ES5/Hermes/React Native — use `@libs/fetch` (not `@/lib/fetch`) and avoid Node/browser-only globals.
- **Finding multisrc plugins**: Search `plugins/multisrc/*/sources.json` by domain or ID; generated `[generator]` files appear under `plugins/indonesian/` after `build:multisrc`. Every source entry must use `options.lang: "Indonesian"`.
- **Trailing slashes on migrated paths**: Existing library entries may contain leading or trailing slashes in `novelPath`. Normalize them in `parseNovel` when migrating to standalone so those entries resolve cleanly.
- **Validation**: Choose checks from `package.json` proportionate to the change. For standalone plugins, run `eslint`, `prettier --check`, `build:compile`, and `check:plugin -- plugins/indonesian/<plugin>.ts`. In `check:plugin`, `FAIL` requires investigation while `INCONCLUSIVE` usually indicates remote site blocking or downtime.
