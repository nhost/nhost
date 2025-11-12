import { DragAndDropList } from '@/components/common/DragAndDropList';

import { isEmptyValue } from '@/lib/utils';
import type { DropResult } from '@hello-pangea/dnd';
import type { ColumnInstance } from 'react-table';
import ColumnCustomizerRow from './ColumnCustomizerRow';
import ShowHideAllColumnsButtons from './ShowHideAllColumnsButtons';

type ColumnCustomizerProps = {
  columns: ColumnInstance[];
  onDragEnd: (columnsOrder: string[]) => void;
  onReset: () => void;
  onShowAllColumns: () => void;
  onHideAllColumns: () => void;
};

function reorder(list: ColumnInstance[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

function ColumnCustomizer({
  columns,
  onDragEnd,
  onReset,
  onShowAllColumns,
  onHideAllColumns,
}: ColumnCustomizerProps) {
  function handleDragEnd(result: DropResult) {
    if (isEmptyValue(result.destination)) {
      return;
    }
    const reordered = reorder(
      columns,
      result.source.index,
      result.destination!.index,
    ).map(({ id }) => id);

    onDragEnd(reordered);
  }

  return (
    <div className="flex max-h-[calc(100%-15rem)] flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h4 className="font-medium leading-none">Column Settings</h4>
        <p className="text-sm text-muted-foreground">
          Reorder columns by dragging or show/hide them with checkboxes.
        </p>
      </div>
      <div className="self-center">
        <ShowHideAllColumnsButtons
          onShowAll={onShowAllColumns}
          onHideAll={onHideAllColumns}
          onReset={onReset}
        />
      </div>
      <div className="overflow-scroll">
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
    </div>
  );
}

export default ColumnCustomizer;
