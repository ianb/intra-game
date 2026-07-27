/**
 * The commit this bundle was built from, substituted by esbuild (see build.ts).
 *
 * Present so a running page can say which build it is. A browser holding a
 * cached bundle is indistinguishable from a deploy that hasn't landed unless
 * the page itself can tell you.
 */
declare const __BUILD_SHA__: string;
