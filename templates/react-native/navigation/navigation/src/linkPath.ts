/**
 * The deep-link pattern React Navigation matches a path against to find the
 * screen named `name`.
 *
 * Expo Router's `[id]` is React Navigation's `:id`, and a `(group)` is left out
 * because it is not part of the URL. A catch-all `[...rest]` and `+not-found`
 * both become `*`, which takes whatever no other screen matches, though the
 * catch-all gets no parameter for the segments it took.
 *
 * Kept out of `screens.ts` so it can be tested: that module runs Metro's
 * `require.context` as it loads, which nothing else provides.
 */
export function linkPath(name: string): string {
  return name
    .split('/')
    .filter((part) => !/^\(.+\)$/.test(part))
    .map((part) =>
      /^\[\.\.\.\w+\]$/.test(part) || part === '+not-found'
        ? '*'
        : part.replace(/^\[(\w+)\]$/, ':$1'),
    )
    .filter(Boolean)
    .join('/');
}
