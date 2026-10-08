import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import { DEFAULT_DESTINATION, signInHref } from '@/signin/destination';
import { useNext } from '@/signin/useNext';

// What every sign-in method reads `next` through, so it is tested from the
// address as a crafted link would carry it: percent-encoded, and decoded by
// vue-router before `signInDestination` sees it.
async function nextFor(location: string): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)', component: { render: () => null } }],
  });
  await router.push(location);

  return renderToString(
    createSSRApp({
      setup() {
        const next = useNext();
        return () => next.value;
      },
    }).use(router),
  );
}

describe('useNext', () => {
  it('keeps a path on this site', async () => {
    expect(await nextFor('/signin?next=%2Fprotected')).toBe('/protected');
  });

  // What a route guard hands over: a named route's `fullPath`, which vue-router
  // encodes except for the brackets.
  it('keeps a guard-built fullPath with brackets in a param', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ name: 'item', path: '/items/:id', component: {} }],
    });
    const { fullPath } = router.resolve({
      name: 'item',
      params: { id: '[1] café' },
    });

    expect(fullPath).toBe('/items/[1]%20caf%C3%A9');
    expect(await nextFor(signInHref(fullPath))).toBe(fullPath);
  });

  it('falls back without a value', async () => {
    expect(await nextFor('/signin')).toBe(DEFAULT_DESTINATION);
    expect(await nextFor('/signin?next')).toBe(DEFAULT_DESTINATION);
  });

  // This is what the OAuth page puts straight into `redirectTo`.
  it('refuses a dot segment that normalizes to another origin', async () => {
    expect(await nextFor('/signin?next=%2F..%2F%2Fevil.example')).toBe(
      DEFAULT_DESTINATION,
    );
    expect(await nextFor('/signin?next=%2F%252e%252e%2F%2Fevil.example')).toBe(
      DEFAULT_DESTINATION,
    );
  });

  // vue-router hands the trailing space through, which the auth service
  // would put back on the address as `%20`.
  it('refuses a path ending in whitespace', async () => {
    expect(await nextFor('/signin?next=%2F.%2F%2F..%20')).toBe(
      DEFAULT_DESTINATION,
    );
  });

  it('reads only the first of a repeated parameter', async () => {
    expect(
      await nextFor('/signin?next=%2F..%2F%2Fevil.example&next=%2Fprotected'),
    ).toBe(DEFAULT_DESTINATION);
  });
});
