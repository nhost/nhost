// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { useRefresh } from '@/components/useRefresh';
import { createAuth } from '@/lib/nhost/auth';
import { useLoad } from '@/lib/useLoad';
import { type Mounted, mountAt, routerAt, settle } from '@/test/mount';

vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({ checkRevoked: async () => undefined, stop: vi.fn() }),
}));

vi.mock('@/lib/nhost/client', () => ({
  nhost: { getUserSession: () => null },
}));

let refresh: VoidFunction = () => undefined;
let rerender: VoidFunction = () => undefined;

const Loaded = defineComponent({
  props: { load: { type: Function, required: true } },
  setup(props) {
    refresh = useRefresh();
    const renders = ref(0);
    rerender = () => {
      renders.value += 1;
    };
    const value = useLoad(props.load as () => Promise<string>);
    return () =>
      h('p', { 'data-renders': renders.value }, value.value ?? 'loading');
  },
});

async function render(load: () => Promise<string>): Promise<Mounted> {
  const router = await routerAt();
  return mountAt(Loaded, '/', {
    props: { load },
    router,
    plugins: [createAuth({ router, recheck: () => undefined })],
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLoad', () => {
  it('shows what the load resolved to, and loads again on useRefresh()', async () => {
    let n = 0;
    const { el } = await render(async () => `load ${++n}`);

    expect(el.textContent).toBe('load 1');

    refresh();
    await settle();

    expect(el.textContent).toBe('load 2');
  });

  it('loads once however often the page renders', async () => {
    const load = vi.fn(async () => 'loaded');
    await render(load);

    rerender();
    await settle();

    expect(load).toHaveBeenCalledOnce();
  });

  // A slow first answer must not overwrite the one a refresh brought.
  it('drops an answer that a newer load overtook', async () => {
    const answers: Array<(value: string) => void> = [];
    const { el } = await render(
      () =>
        new Promise<string>((resolve) => {
          answers.push(resolve);
        }),
    );
    refresh();
    await settle();

    answers[1]?.('second');
    await settle();
    answers[0]?.('first');
    await settle();

    expect(el.textContent).toBe('second');
  });

  it('keeps what it had when a load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = false;
    const { el } = await render(async () => {
      if (fail) {
        throw new Error('offline');
      }
      return 'loaded';
    });

    fail = true;
    refresh();
    await settle();

    expect(el.textContent).toBe('loaded');
  });
});
