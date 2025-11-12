import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import PersistenDataTableConfigurationStorage from '@/features/orgs/projects/storage/dataGrid/utils/PersistenDataTableConfigurationStorage';
import { ColumnCustomizer } from './ColumnCustomizer';
import { useDataGridCustomizerOpenStateContext } from './DataGridCustomizerOpenStateProvider';
import DataGridCustomizerTrigger from './DataGridCustomizerTrigger';
import RowDensityCustomizer from './RowDensityCustomizer';

function DataGridCustomizerControls() {
  const { allColumns, setColumnOrder, setHiddenColumns } = useDataGridConfig();
  const tablePath = useTablePath();
  const { open, setOpen } = useDataGridCustomizerOpenStateContext();

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

  function handleDragEnd(newOrder: string[]) {
    setColumnOrder(newOrder);
    PersistenDataTableConfigurationStorage.saveColumnOrder(tablePath, newOrder);
  }

  function hideAllColumns() {
    const allColumnsId = columns.map(({ id }) => id);
    saveHiddenCols(allColumnsId);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <DataGridCustomizerTrigger />
      </SheetTrigger>

      <SheetContent
        className="box flex w-full flex-col rounded-none md:w-[26rem] md:max-w-[26rem]"
        onInteractOutside={() => setOpen(false)}
        showOverlay
      >
        <SheetHeader>
          <SheetTitle>Customize Table View</SheetTitle>
          <SheetDescription className="sr-only">
            Customize columns
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col gap-8">
          <RowDensityCustomizer />
          <ColumnCustomizer
            columns={columns}
            onDragEnd={handleDragEnd}
            onReset={handleReset}
            onShowAllColumns={() => saveHiddenCols([])}
            onHideAllColumns={hideAllColumns}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default DataGridCustomizerControls;
