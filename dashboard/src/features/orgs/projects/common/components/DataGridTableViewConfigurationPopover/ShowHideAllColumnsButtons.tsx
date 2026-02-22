import type { VisibilityState } from '@tanstack/react-table';
import { Button } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import {
  saveColumnOrder,
  saveColumnVisibility,
} from '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage';

function ShowHideAllColumnsButtons() {
  const tablePath = useTablePath();

  const { getAllColumns, setColumnOrder, setColumnVisibility } =
    useDataGridConfig();
  const allColumns = getAllColumns();

  const columns = allColumns.filter(({ id }) => id !== SELECTION_COLUMN_ID);

  function saveVisibility(visibility: VisibilityState) {
    setColumnVisibility(visibility);
    saveColumnVisibility(tablePath, visibility);
  }

  function showOriginalOrder() {
    setColumnOrder([]);
    saveColumnOrder(tablePath, []);
  }

  function handleReset() {
    showOriginalOrder();
    saveVisibility({});
  }

  function hideAllColumns() {
    const newVisibility: VisibilityState = {};

    columns.forEach((column) => {
      newVisibility[column.id] = false;
    });

    saveVisibility(newVisibility);
  }
  return (
    <div className="flex w-full justify-between">
      <ButtonGroup className="flex justify-start">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => saveVisibility({})}
        >
          Show all columns
        </Button>
        <Button variant="secondary" className="flex-1" onClick={hideAllColumns}>
          Hide all columns
        </Button>
      </ButtonGroup>
      <Button variant="outline" onClick={handleReset}>
        Reset
      </Button>
    </div>
  );
}

export default ShowHideAllColumnsButtons;
