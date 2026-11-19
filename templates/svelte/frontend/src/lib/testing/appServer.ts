import type { RequestEvent } from '@sveltejs/kit';
import type { RemoteForm, RemoteFormInput } from '$app/server';
import { type FakeRequest, fakeEvent } from './requestEvent.ts';

// The part of a Standard Schema, such as a valibot schema, that is used here.
type Schema = {
  '~standard': {
    validate: (
      value: unknown,
    ) => MaybePromise<{ value?: unknown; issues?: readonly unknown[] }>;
  };
};
type MaybePromise<T> = T | Promise<T>;

let current: RequestEvent | undefined;

/** Starts the request the next remote calls run in, and returns it. */
export function inRequest(request: FakeRequest = {}) {
  const fake = fakeEvent(request);
  current = fake.event;
  return fake;
}

// A remote function as its module defines it, called directly: the argument
// is checked against its schema, as SvelteKit checks what the client sends.
// The tag is what SvelteKit looks for on every export of a remote module.
const remote =
  (type: 'command' | 'form' | 'query') =>
  (
    schemaOrFn: Schema | 'unchecked' | ((arg?: unknown) => unknown),
    fn?: (arg: unknown) => unknown,
  ) => {
    const call = checked(schemaOrFn, fn);
    return Object.assign(call, { __: { type } });
  };

function checked(
  schemaOrFn: Schema | 'unchecked' | ((arg?: unknown) => unknown),
  fn?: (arg: unknown) => unknown,
): (arg?: unknown) => unknown {
  if (typeof schemaOrFn === 'function') {
    return schemaOrFn;
  }
  if (!fn) {
    throw new Error('A remote function needs a schema and a function.');
  }
  if (schemaOrFn === 'unchecked') {
    return fn;
  }
  return async (arg: unknown) => {
    const result = await schemaOrFn['~standard'].validate(arg);
    if (result.issues) {
      throw new Error('Bad Request');
    }
    return fn(result.value);
  };
}

/**
 * Stands in for `$app/server` in tests of remote modules:
 * `vi.mock('$app/server', () => import('#lib/testing/appServer.ts'))`.
 */
export const command = remote('command');
export const form = remote('form');
export const query = remote('query');
export const getRequestEvent = (): RequestEvent => {
  if (!current) {
    throw new Error('Call inRequest() first.');
  }
  return current;
};

/** A remote form's handler, which is what the form is under this stand-in. */
export const handlerOf = <Input extends RemoteFormInput, Output>(
  form: RemoteForm<Input, Output>,
) => form as unknown as (data: Input) => Promise<Output>;
