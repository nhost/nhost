import { Button } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import PersistenDataTableConfigurationStorage from '@/features/orgs/projects/storage/dataGrid/utils/PersistenDataTableConfigurationStorage';

function ShowHideAllColumnsButtons() {
  const tablePath = useTablePath();

  const { allColumns, setColumnOrder, setHiddenColumns } = useDataGridConfig();

  const columns = allColumns.filter(({ id }) => id !== 'selection-column');

  function saveHiddenCols(cols: string[]) {
    setHiddenColumns(cols);
    PersistenDataTableConfigurationStorage.saveHiddenColumns(tablePath, cols);
  }

  function showOriginalOrder() {
    setColumnOrder([]);
    PersistenDataTableConfigurationStorage.saveColumnOrder(tablePath, []);
  }

  function handleReset() {
    showOriginalOrder();
    saveHiddenCols([]);
  }

  function hideAllColumns() {
    const allColumnsId = columns.map(({ id }) => id);
    saveHiddenCols(allColumnsId);
  }
  return (
    <div className="flex w-full justify-between">
      <ButtonGroup className="flex justify-start">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => saveHiddenCols([])}
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
