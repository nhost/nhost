import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';

export default function formatRemoteSourceEndpoint(
  sourceName: string | undefined,
  schemaName: string | undefined,
  name: string | undefined,
  columns: string[],
) {
  const endpoint = formatEndpoint(
    schemaName ?? 'public',
    name ?? 'unknown_table',
    columns,
  );

  return sourceName ? `${sourceName} :: ${endpoint}` : endpoint;
}
