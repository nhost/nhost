import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import DataBrowserGrid from './DataBrowserGrid';
import { DataGridQueryParamsProvider } from './DataGridQueryParamsProvider';

export default function DataBrowserGridContainer() {
  const tablePath = useTablePath();

  return (
    <DataGridQueryParamsProvider key={tablePath} storageKey={tablePath}>
      <DataBrowserGrid />
    </DataGridQueryParamsProvider>
  );
}
