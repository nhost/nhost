import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useIntent } from '@/signin/useIntent';

async function intentFor(location: string): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)', component: { render: () => null } }],
  });
  await router.push(location);

  return renderToString(
    createSSRApp({
      setup() {
        const intent = useIntent();
        return () => intent.value;
      },
    }).use(router),
  );
}

describe('useIntent', () => {
  it('reads the intent the link asked for', async () => {
    expect(await intentFor('/signin?intent=sign-in')).toBe('sign-in');
  });

  // vue-router reports a bare `?intent` as null.
  it('signs up without a value', async () => {
    expect(await intentFor('/signin')).toBe('sign-up');
    expect(await intentFor('/signin?intent')).toBe('sign-up');
  });

  it('reads only the first of a repeated parameter', async () => {
    expect(await intentFor('/signin?intent=sign-in&intent=sign-up')).toBe(
      'sign-in',
    );
  });
});
