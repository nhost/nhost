import { cn } from '@/lib/utils';
import {
  DragDropContext,
  Droppable,
  type DragDropContextProps,
  type DroppableProps,
} from '@hello-pangea/dnd';
import type { PropsWithChildren } from 'react';

type DragAndDropListProps = Omit<
  DroppableProps & DragDropContextProps,
  'children'
> & {
  wrapperClassName?: string;
};

function DragAndDropList({
  droppableId,
  onDragEnd,
  children,
  wrapperClassName,
}: PropsWithChildren<DragAndDropListProps>) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={cn(wrapperClassName)}
          >
            {children}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

export default DragAndDropList;
