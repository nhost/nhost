import { GripVertical } from 'lucide-react';
import type { ColumnInstance } from 'react-table';
import {
  DraggableItem,
  type DraggableItemProps,
} from '@/components/common/DragAndDropList';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import PersistenDataTableConfigurationStorage from '@/features/orgs/projects/storage/dataGrid/utils/PersistenDataTableConfigurationStorage';
import { cn } from '@/lib/utils';

type ColumnCustomizerProps = {
  column: ColumnInstance;
} & Omit<DraggableItemProps, 'draggableId'>;

function ColumnCustomizerRow({ column, index }: ColumnCustomizerProps) {
  const tablePath = useTablePath();

  function handleVisibilityChange() {
    PersistenDataTableConfigurationStorage.toggleColumnVisibility(
      tablePath,
      column.id,
    );
    column.toggleHidden();
  }

  return (
    <DraggableItem draggableId={column.id} index={index} className="mb-3">
      <div
        className={cn(
          'flex w-full items-center justify-between rounded-md bg-accent p-2',
          { 'opacity-70': !column.isVisible },
        )}
      >
        <div className="flex items-center gap-5">
          <Checkbox
            checked={column.isVisible}
            className="data-[state=checked]:!border-transparent h-[1.125rem] w-[1.125rem] border-[#21324b] dark:border-[#dfecf5]"
            onCheckedChange={handleVisibilityChange}
          />
          <span>{column.id}</span>
        </div>
        <GripVertical />
      </div>
    </DraggableItem>
  );
}

export default ColumnCustomizerRow;
