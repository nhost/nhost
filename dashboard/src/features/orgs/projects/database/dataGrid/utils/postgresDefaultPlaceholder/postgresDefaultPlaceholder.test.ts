import type { Resolver } from 'react-hook-form';
import { vi } from 'vitest';
import {
  POSTGRES_DEFAULT_PLACEHOLDER,
  wrapResolverWithDefaultPlaceholder,
} from './postgresDefaultPlaceholder';

type FormValues = Record<string, unknown>;

function makeResolver(impl: Resolver<FormValues>) {
  return vi.fn(impl);
}

describe('wrapResolverWithDefaultPlaceholder', () => {
  it('replaces sentinel values with undefined before delegating to the base resolver', async () => {
    let receivedValues: FormValues | undefined;
    const base = makeResolver(async (values) => {
      receivedValues = { ...values };
      return { values, errors: {} };
    });
    const wrapped = wrapResolverWithDefaultPlaceholder(base);

    await wrapped(
      { a: POSTGRES_DEFAULT_PLACEHOLDER, b: 'hello', c: null },
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: minimal resolver options shape
      {} as any,
    );

    expect(base).toHaveBeenCalledTimes(1);
    expect(receivedValues).toEqual({
      a: undefined,
      b: 'hello',
      c: null,
    });
  });

  it('re-applies the sentinel onto validated values', async () => {
    const base = makeResolver(async () => ({
      values: { a: undefined, b: 'hello' },
      errors: {},
    }));
    const wrapped = wrapResolverWithDefaultPlaceholder(base);

    const result = await wrapped(
      { a: POSTGRES_DEFAULT_PLACEHOLDER, b: 'hello' },
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: minimal resolver options shape
      {} as any,
    );

    expect(result.values).toEqual({
      a: POSTGRES_DEFAULT_PLACEHOLDER,
      b: 'hello',
    });
  });

  it('leaves non-sentinel values untouched on the way out', async () => {
    const base = makeResolver(async (values) => ({ values, errors: {} }));
    const wrapped = wrapResolverWithDefaultPlaceholder(base);

    const result = await wrapped(
      { a: 'foo', b: null, c: '' },
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: minimal resolver options shape
      {} as any,
    );

    expect(result.values).toEqual({ a: 'foo', b: null, c: '' });
  });

  it('passes validation errors through unchanged', async () => {
    const base = makeResolver(async () => ({
      values: {},
      errors: { a: { type: 'required', message: 'required' } },
    }));
    const wrapped = wrapResolverWithDefaultPlaceholder(base);

    const result = await wrapped(
      { a: POSTGRES_DEFAULT_PLACEHOLDER },
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: minimal resolver options shape
      {} as any,
    );

    expect(result.errors).toEqual({
      a: { type: 'required', message: 'required' },
    });
  });

  it('does not mutate the input values object', async () => {
    const base = makeResolver(async (values) => ({ values, errors: {} }));
    const wrapped = wrapResolverWithDefaultPlaceholder(base);

    const input = { a: POSTGRES_DEFAULT_PLACEHOLDER, b: 'hello' };
    await wrapped(
      input,
      undefined,
      // biome-ignore lint/suspicious/noExplicitAny: minimal resolver options shape
      {} as any,
    );

    expect(input).toEqual({
      a: POSTGRES_DEFAULT_PLACEHOLDER,
      b: 'hello',
    });
  });
});
