import { DragAndDropList } from '@/components/common/DragAndDropList';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import PersistenDataTableConfigurationStorage from '@/features/orgs/projects/storage/dataGrid/utils/PersistenDataTableConfigurationStorage';
import { isEmptyValue } from '@/lib/utils';
import type { DropResult } from '@hello-pangea/dnd';
import type { ColumnInstance } from 'react-table';
import ColumnCustomizerRow from './ColumnCustomizerRow';
import ShowHideAllColumnsButtons from './ShowHideAllColumnsButtons';

function reorder(list: ColumnInstance[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

function ColumnCustomizer() {
  const tablePath = useTablePath();
  const { allColumns, setColumnOrder } = useDataGridConfig();
  const columns = allColumns.filter(({ id }) => id !== 'selection-column');

  function handleDragEnd(result: DropResult) {
    if (isEmptyValue(result.destination)) {
      return;
    }
    const reordered = reorder(
      columns,
      result.source.index,
      result.destination!.index,
    ).map(({ id }) => id);

    setColumnOrder(reordered);
    PersistenDataTableConfigurationStorage.saveColumnOrder(
      tablePath,
      reordered,
    );
  }

  return (
    <div className="flex max-h-[calc(var(--radix-popover-content-available-height)-16rem)] flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h4 className="font-medium leading-none">Column Settings</h4>
        <p className="text-muted-foreground text-sm">
          Reorder columns by dragging or show/hide them with checkboxes.
        </p>
      </div>
      <div className="overflow-y-scroll">
        <DragAndDropList droppableId="columnOrder" onDragEnd={handleDragEnd}>
          {columns.map((column, index) => (
            <ColumnCustomizerRow
              key={column.id}
              column={column}
              index={index}
            />
          ))}
        </DragAndDropList>
      </div>
      <ShowHideAllColumnsButtons />
    </div>
  );
}

export default ColumnCustomizer;
