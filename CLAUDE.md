# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies and set up Husky pre-commit hooks
npm run lint         # Run ESLint on all JS files
npm run lint:fix     # Run ESLint with auto-fix
npm run prettier     # Format all .md, .html, .json files
```

Pre-commit hooks run `lint-staged` automatically (ESLint + Prettier on staged files).

For samples with a build process (e.g., `functional-samples/ai.gemini-on-device/`):

```bash
cd functional-samples/<sample-name>
npm install
npm run build        # typically uses Rollup; load the dist/ directory in Chrome
```

For samples with Puppeteer/Jest tests (e.g., `functional-samples/tutorial.puppeteer/`):

```bash
cd functional-samples/tutorial.puppeteer
npm install
npm start            # runs jest
```

## Repository Structure

- **`api-samples/`** — samples each focused on a single Chrome API (named after the API, e.g., `action/`, `bookmarks/`)
- **`functional-samples/`** — multi-feature applications, prefixed by category:
  - `tutorial.*` — step-by-step learning samples
  - `cookbook.*` — how-to recipes for specific features
  - `sample.*` — feature-rich demo applications
  - `ai.gemini-*` — samples using Chrome's built-in Gemini Nano / Prompt API
  - `reference.*` — reference implementations
- **`_archive/`** — deprecated; contains MV2 samples (`_archive/mv2/`) and Chrome Apps (`_archive/apps/`). Do not add samples here.
- **`.repo/sample-list-generator/`** — internal TypeScript tool that generates `extension-samples.json` metadata; not part of the extension samples themselves.

## Key Conventions

### Manifest Version

All active samples use **Manifest V3**. Never use `manifest_version: 2` in new samples.

### Sample Structure

Minimal sample:

```
sample-name/
├── manifest.json
├── *.js / *.html / *.css
├── icons/            # 16.png, 32.png, 128.png, 512.png (or images/)
└── README.md
```

Sample with a build step:

```
sample-name/
├── manifest.json
├── package.json
├── rollup.config.mjs
├── src/
├── dist/             # build output — Chrome loads this (gitignored)
└── README.md
```

Place third-party/external CSS or JS in a `third-party/` subdirectory.

### JavaScript

- All extension code is **vanilla JavaScript** (ES6+ modules, `.js`/`.mjs`). No TypeScript in samples.
- Use `let`/`const` — `var` is forbidden by ESLint.
- Prefix intentionally unused parameters/variables with `_` to suppress lint warnings.

### Code Style (enforced by ESLint + Prettier)

- 2-space indentation, 80-char print width
- Single quotes, semicolons, no trailing commas
- Arrow function parens always: `(x) => x`

### README

Every sample must have a `README.md`. Use `README-template.md` at the repo root as the template. Required sections: title, overview, running instructions (always includes "Load Unpacked Extension" steps).

### Contributing New Samples

Per `CONTRIBUTING.md`: **open an issue first** to propose a new sample and get maintainer approval before submitting a PR. PRs without an approved issue will be rejected.
