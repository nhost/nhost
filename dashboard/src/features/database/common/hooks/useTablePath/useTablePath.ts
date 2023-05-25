import { useRouter } from 'next/router';

/**
 * Get the current database table path. Use where data browser is available.
 *
 * @returns The current database table path.
 */
export default function useTablePath() {
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
  } = useRouter();

  if (!dataSourceSlug || !schemaSlug || !tableSlug) {
    return '';
  }

  return `${dataSourceSlug as string}.${schemaSlug as string}.${
    tableSlug as string
  }`;
}
