import { vibeCheck } from "@ianbicking/personal-vibe-check/eslint";

// The shared preset encodes callback-box's conventions. Most of it applies here,
// but a few rules fight this project's architecture rather than finding bugs;
// each is turned off below with the reason. Everything else is left on.
export default [
  ...vibeCheck({
    react: true,
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      // wrangler's temporary build output
      ".wrangler/**",
      "playtest/cassettes/**",
    ],
  }),
  {
    rules: {
      // The entity model is deliberately dynamic: entities are looked up by id
      // and narrowed with `as` (isRoom/isPerson guards plus casts). Banning type
      // assertions outright would mean redesigning that model, not fixing bugs.
      "no-restricted-syntax": "off",

      // Preact signals are *made* to be assigned (`signal.value = x`). This rule
      // assumes React hook return values, so every signal write is a false
      // positive here.
      "react-hooks/immutability": "off",

      // Entity state is Record<EntityId, ...> keyed by ids from the fixed world
      // definition, so dynamic indexing is the normal access pattern and this
      // rule fires on nearly every line of it.
      "security/detect-object-injection": "off",

      // This project's tests are doctests under test/*.doctest.md, not .spec.ts
      // files sitting next to the source.
      "ddd/require-spec-file": "off",

      // A callback-box UI convention about className on components; this app's
      // markup predates it and doesn't follow that component structure.
      "custom/jsx-classname-required": "off",

      // Asset/model endpoints (soundtrack CDN, OpenRouter) are legitimately
      // hardcoded in a client-only game with no server config to read from.
      "default/no-hardcoded-urls": "off",
      "default/no-localhost": "off",

      // Custom error classes everywhere is a big convention to retrofit; the
      // engine currently throws plain Errors that the UI surfaces as text.
      // Left off deliberately as a possible later ratchet.
      "error/require-custom-error": "off",
      "error/no-generic-error": "off",
      "error/no-literal-error-message": "off",

      // Defaults in the signature are used throughout the engine's small pure
      // helpers; another candidate for a later ratchet.
      "default/no-default-params": "off",

      // File/function size caps are the codehealth signal we're actively working
      // down (classes.ts and friends), so surface them without failing the run.
      "max-lines": "warn",
      "max-lines-per-function": "warn",

      // Down from 71 to 2, so this is now an error rather than a warning: any
      // new `any` has to be argued for at the point it appears. The two that
      // remain are the before/after payloads of ChangeType, disabled inline
      // with the reason. The dynamic entity access that caused most of the
      // original 71 goes through lib/game/dynamic.ts, and the debug globals
      // through lib/debugglobal.ts.
      "@typescript-eslint/no-explicit-any": "error",

      // eslint-plugin-import's TypeScript resolver is incompatible with the
      // version resolved here ("invalid interface loaded as resolver"), so this
      // rule can only report that failure, not real ordering problems. Import
      // order was already normalized by its autofix before turning it off, and
      // the bundled import-x rules still cover import hygiene.
      "import/order": "off",
    },
  },
  {
    // lib/game/content is prose, not logic: room descriptions, roleplay
    // instructions, daily routines. Splitting a character's description across
    // files to satisfy a line cap would make it harder to read, not easier, so
    // the cap here is about staying loadable in one sitting rather than about
    // complexity. Anything in this directory that starts wanting *behaviour*
    // belongs in ../classes.ts instead, where the normal cap applies.
    files: ["lib/game/content/**"],
    rules: { "max-lines": ["warn", 600] },
  },
  {
    // The playtest and eval harnesses are local dev tools that read and write
    // cassettes and result files by path, the build script walks the checkpoint
    // directory, and the image generator writes assets by path; flagging that as
    // a filesystem risk isn't meaningful for code that only ever runs on a
    // developer's machine or the builder.
    files: ["playtest/**", "evals/**", "images/**", "build.ts", "dev.ts"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
];
