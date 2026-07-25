# Testing & dev tooling

The engine's testable logic is covered with **[agent-doctest](https://github.com/ianb/agent-doctest)**:
tests are executable markdown (`test/**/*.doctest.md`) where each fenced code
block is both documentation and a [tap](https://node-tap.org/) test case. Prose
between blocks explains intent; the code blocks keep it honest.

```bash
npm test           # run all doctests (tap)
npm run test:watch # re-run on change
npm run typecheck  # tsc --noEmit under the strict config
```

Write a doctest as a `.doctest.md` under `test/`. A `ts setup` block holds the
imports; regular blocks are examples where an expression followed by `=>` is
checked against the expected value. See `test/parsetags.doctest.md` for a
worked example and the agent-doctest README for the full syntax.

## Setup notes (why the config looks the way it does)

Getting agent-doctest running against this repo surfaced a few sharp edges,
recorded here so they aren't rediscovered:

- **`"type": "module"` is required.** agent-doctest generates each `.doctest.md`
  as an ESM module. In a CommonJS package, tsx mis-infers the format of imported
  `.ts` files (ESM vs CJS) when the import parent is the `.doctest.md` URL, and
  named imports fail with "does not provide an export named …". All source here
  is already ESM `import`/`export`, so the package is `type: module`.
- **`.taprc` disables Node's native TS stripping** (`--no-experimental-strip-types`)
  so tsx owns all `.ts` loading, and drops the `@tapjs/typescript` plugin in
  favor of tsx.
- **`.npmrc` sets `install-links=true`.** The callback-box tools are consumed as
  local `file:` dependencies. Without `install-links`, npm symlinks them, and
  their peer imports (`@tapjs/core`, …) resolve against the callback-box checkout
  instead of this repo's `node_modules`. `install-links` installs them as real
  copies so resolution works.

## callback-box dependencies (not yet on npm)

`@ianbicking/personal-vibe-check` (strict tsconfig + lint preset) and
`agent-doctest` are consumed via `file:` paths into a local callback-box
checkout. **Those paths are environment-specific** — adjust the `file:` entries
in `package.json` to wherever callback-box is checked out. Once callback-box is
published (or vendored as a submodule), these should become normal version or
submodule-relative dependencies.

## Type strictness

`tsconfig.json` extends `@ianbicking/personal-vibe-check/tsconfig.base.json`
(`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
…). Keep `npm run typecheck` clean.

The full lint preset (ESLint 9 flat config, knip, madge, prettier) is a later
adoption step — see the repo's task notes.
