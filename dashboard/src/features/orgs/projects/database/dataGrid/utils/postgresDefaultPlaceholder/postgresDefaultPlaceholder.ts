import type { Resolver } from 'react-hook-form';

// Impossible to type in a normal text input — used to distinguish DEFAULT from NULL in nullable+hasDefault form fields.
export const POSTGRES_DEFAULT_PLACEHOLDER = '\x00DEFAULT\x00';

export function wrapResolverWithDefaultPlaceholder<
  T extends Record<string, unknown>,
>(base: Resolver<T>): Resolver<T> {
  return async (values, context, options) => {
    const sanitized = { ...(values as Record<string, unknown>) };
    for (const key of Object.keys(sanitized)) {
      if (sanitized[key] === POSTGRES_DEFAULT_PLACEHOLDER) {
        sanitized[key] = undefined;
      }
    }
    const result = await base(sanitized as T, context, options);
    if (result.values) {
      for (const key of Object.keys(values as Record<string, unknown>)) {
        if (
          (values as Record<string, unknown>)[key] ===
          POSTGRES_DEFAULT_PLACEHOLDER
        ) {
          (result.values as Record<string, unknown>)[key] =
            POSTGRES_DEFAULT_PLACEHOLDER;
        }
      }
    }
    return result;
  };
}
