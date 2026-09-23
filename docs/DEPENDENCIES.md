# Development dependencies

Notes for whoever updates `package.json`. Last reviewed September 2026 against `@wordpress/scripts` 36.0.0 and `@wp-playground/cli` 3.1.55.

A clean `npm install` reports **0 vulnerabilities**. The only output is three deprecation notices that sit inside upstream tools (see [Known remaining notices](#known-remaining-notices)).

## Toolchain

- **Node 24 LTS** (`.nvmrc`). `@wordpress/scripts` 36 requires Node `^22.22.2 || ^24.15.0 || >=26`, mirrored in `engines`. Run `nvm use` in the project before installing.
- **Unit tests run on Vitest 5 + Vite 8.** From version 36, `wp-scripts test-unit-js` runs Vitest. The old Jest path needs the retired `@wordpress/jest-preset-default`, so the suite was moved instead. Test files import `describe`/`test`/`expect` from `vitest`. The config is `vitest.config.mjs` (Node environment, no globals).
- **React 18.3.1** is pinned as a dev dependency because WordPress core ships 18.3.1. The build never bundles React (it uses `window.React`). The pin only stops npm from trying React 19 first while resolving, which caused a burst of `ERESOLVE overriding peer dependency` warnings.
- **ESLint 10** is a direct dev dependency so the `overrides` below can reference it as `$eslint`.

## Overrides

Each override forces a patched version of a package that one of our dependencies still pins to an old release. Every one keeps the API its consumer uses. Remove an override once the named parent ships the fix itself. `npm ls <package>` shows who pulls it in.

| Override | Pulled in by | Why | Remove when |
|---|---|---|---|
| `serialize-javascript` → `^7.0.3` | `copy-webpack-plugin@10` (via `@wordpress/scripts`) | 6.x has an RCE and a CPU-exhaustion advisory. 7.x keeps the same `serialize()` function; copy-webpack-plugin 13+ itself depends on it. | `@wordpress/scripts` moves to copy-webpack-plugin ≥ 13 |
| `qs` → `^6.16.0` | `express@4.22.2` / `body-parser` (via `@wp-playground/cli`) | Array-limit bypass and DoS advisories below 6.16. Same 6.x API. | Playground CLI pins a patched Express |
| `sockjs` › `uuid` → `^11.1.1` | `webpack-dev-server` (via `@wordpress/scripts`) | uuid 8 has a buffer-bounds advisory and is deprecated. sockjs uses `require('uuid').v4`, which uuid 11 still supports in CommonJS. | sockjs publishes a release on uuid ≥ 11 |
| `@wordpress/scripts` › `source-map-loader` → `^5.0.0` | `@wordpress/scripts` | v3 depends on the deprecated `abab`. v5 is a drop-in webpack 5 loader. It only runs when a devtool is set (`npm start`, or `WP_DEVTOOL`). | `@wordpress/scripts` depends on source-map-loader ≥ 4 |
| `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react` › `eslint` → `$eslint` | `@wordpress/eslint-plugin@27` | These plugins haven't declared ESLint 10 support, so npm installed a second, deprecated ESLint 9 just for them. `wp-scripts lint-js` already runs them under ESLint 10; lint results were compared rule by rule before and after. | The plugins list `^10` in their peer ranges |

## Install scripts (`allowScripts`)

npm 11 asks projects to approve or deny dependency install scripts. Decisions, based on reading each script:

| Package | Decision | Reason |
|---|---|---|
| `fs-ext-extra-prebuilt` (WordPress Playground) | allow | Loads a prebuilt native addon, or compiles one on platforms without a prebuilt. |
| `unrs-resolver` (ESLint import resolver) | allow | Repairs the platform-specific native binary if npm skipped the optional dependency. |
| `core-js`, `core-js-pure` | deny | The postinstall only prints a funding banner. |
| `@parcel/watcher` (Sass) | deny | Only compiles from source when `npm_config_build_from_source=true`; prebuilt binaries arrive as normal dependencies. |
| `fsevents` (macOS file watching) | deny | The package ships its prebuilt `fsevents.node`; the hook would only recompile it with Xcode. |

Run `npm install-scripts ls` after dependency updates to review anything new.

## Known remaining notices

| Notice | Where | Why it stays |
|---|---|---|
| `glob@7.2.3` deprecated and `inflight@1.0.6` deprecated | `npm-packlist@3`, used only by `wp-scripts plugin-zip` when `package.json` has a `files` field | No release of npm-packlist that keeps the synchronous API wp-scripts calls has moved off glob 7, and overriding `glob` breaks npm-packlist. A local compatibility wrapper was tried and rejected: npm resolves `file:` paths in nested overrides relative to the dependent package and hoists them, which replaced the project-wide `glob`. The advisory-relevant part of glob 7 (`minimatch`) resolves to a patched 3.1.5, and `plugin-zip` is a short-lived command, so `inflight`'s leak cannot accumulate. Fix belongs in `@wordpress/scripts`. |
| `@octokit/webhooks-types@7.6.1` deprecated | `octokit@3` inside `@wp-playground/storage` (Playground's GitHub integration) | The package contains only a TypeScript declaration file (`schema.d.ts`); no JavaScript ever loads it. Fix belongs in WordPress Playground. |

## Checking after an update

```bash
nvm use
rm -rf node_modules package-lock.json && npm install   # expect 0 vulnerabilities
npm install-scripts ls                                  # expect nothing unreviewed
npm run verify                                          # build, unit tests, PHP lint, both smoke suites
```
