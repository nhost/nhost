import { Button } from '@/components/ui/v3/button';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { saveColumnVisibility } from '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage';

function Description() {
  const { setColumnVisibility } = useDataGridConfig();
  const tablePath = useTablePath();

  function saveHiddenCols() {
    setColumnVisibility({});
    saveColumnVisibility(tablePath, {});
  }

  return (
    <Button variant="outline" onClick={saveHiddenCols}>
      Reset column settings
    </Button>
  );
}

function AllColumnsHiddenMessage() {
  return (
    <DataBrowserEmptyState
      title="All columns are hidden"
      description={<Description />}
    />
  );
}

export default AllColumnsHiddenMessage;
