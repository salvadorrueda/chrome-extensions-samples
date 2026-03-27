# GitHub Copilot Instructions

## Commands

```bash
npm install          # Install dependencies (also sets up Husky pre-commit hooks)
npm run lint         # Run ESLint on all JS files
npm run lint:fix     # Run ESLint with auto-fix
npm run prettier     # Format all .md, .html, .json files
```

Pre-commit hooks run `lint-staged` automatically (ESLint + Prettier on staged files).

Samples with a build process (e.g., `functional-samples/ai.gemini-on-device/`) have their own `package.json`:

```bash
cd functional-samples/<sample-name>
npm install
npm run build        # typically uses Rollup; load the dist/ directory in Chrome
```

## Repository Structure

This repo is the official Chrome Extensions sample repository, maintained by the Chrome team.

- **`api-samples/`** — ~37 samples, each focused on a single Chrome API (named after the API, e.g., `action/`, `bookmarks/`, `tabs/`)
- **`functional-samples/`** — ~50 multi-feature applications, prefixed by category:
  - `tutorial.*` — step-by-step learning samples
  - `cookbook.*` — how-to recipes for specific features
  - `sample.*` — feature-rich demo applications
  - `ai.gemini-*` — samples using Chrome's built-in Gemini Nano / Prompt API
  - `reference.*` — reference implementations
- **`_archive/`** — deprecated; contains MV2 reference samples (`_archive/mv2/`) and Chrome Apps (`_archive/apps/`). Do not add samples here.
- **`.repo/sample-list-generator/`** — internal TypeScript tool that generates `extension-samples.json` metadata; not part of the extension samples themselves.

## Key Conventions

### Manifest Version

All active samples (both `api-samples/` and `functional-samples/`) use **Manifest V3**. Never use `manifest_version: 2` in new samples.

### Sample Structure

A minimal sample:

```
sample-name/
├── manifest.json
├── *.js / *.html / *.css
├── icons/            # 16.png, 32.png, 128.png, 512.png (or images/ directory)
└── README.md
```

For samples with a build step:

```
sample-name/
├── manifest.json
├── package.json
├── rollup.config.mjs
├── src/              # source files
├── dist/             # build output — this is what Chrome loads (gitignored)
└── README.md
```

Place third-party/external CSS or JS in a `third-party/` subdirectory.

### JavaScript

- All extension code is **vanilla JavaScript** (ES6+ modules, `.js`/`.mjs`). No TypeScript in samples.
- Use `let`/`const` — `var` is forbidden by ESLint.
- Prefix intentionally unused parameters/variables with `_` to suppress the lint warning.

### Code Style (enforced by ESLint + Prettier)

- 2-space indentation, 80-char print width
- Single quotes, semicolons, no trailing commas
- Arrow function parens always: `(x) => x`

### README

Every sample must have a `README.md`. Use `README-template.md` at the repo root as the template. Required sections: title, overview, running instructions (always includes "Load Unpacked Extension" steps).

### Contributing New Samples

Per `CONTRIBUTING.md`: **open an issue first** to propose a new sample and get maintainer approval before submitting a PR. PRs without an approved issue will be rejected. A Google CLA must be signed before contributions are accepted.
