import { useParams } from '@tanstack/react-router';

/**
 * Get the current database table path. Use where data browser is available.
 *
 * @returns The current database table path.
 */
export default function useTablePath() {
  const { dataSourceSlug, schemaSlug, tableSlug } = useParams({
    strict: false,
  });

  if (!dataSourceSlug || !schemaSlug || !tableSlug) {
    return '';
  }

  return `${dataSourceSlug as string}.${schemaSlug as string}.${
    tableSlug as string
  }`;
}
