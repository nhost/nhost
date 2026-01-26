import { useRouter } from 'next/router';

/**
 * Get the current database function path. Use where data browser is available.
 *
 * @returns The current database function path.
 */
export default function useFunctionPath() {
  const {
    query: { dataSourceSlug, schemaSlug, functionSlug },
  } = useRouter();

  if (!dataSourceSlug || !schemaSlug || !functionSlug) {
    return '';
  }

  return `${dataSourceSlug as string}.${schemaSlug as string}.${
    functionSlug as string
  }`;
}
