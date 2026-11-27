import { vi } from 'vitest';

/**
 * Stands in for a remote `form` in component tests: spreads onto a <form> as
 * its method and action, gives each field its attributes, and submits through
 * a mock whose answer becomes `result`.
 */
export function fakeForm<Result>() {
  let result: Result | undefined;
  const submit = vi.fn<() => Promise<Result | undefined>>();

  // Only method and action are enumerable, so spreading the form onto the
  // element adds nothing else, as with SvelteKit's.
  const form = Object.defineProperties(
    { method: 'POST' as const, action: '?/remote' },
    {
      result: { get: () => result },
      submit: {
        value: async (): Promise<boolean> => {
          result = await submit();
          return true;
        },
      },
      fields: {
        value: new Proxy(
          {},
          {
            get: (_, name) => ({
              as: (type: string) => ({ name: String(name), type }),
            }),
          },
        ),
      },
    },
  );

  return { form, submit };
}
