import { Draggable, type DraggableProps } from '@hello-pangea/dnd';
import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

export type DraggableItemProps = PropsWithChildren<
  Omit<DraggableProps, 'children'> & { className?: string }
>;

function DraggableItem({
  children,
  className,
  ...draggableProps
}: DraggableItemProps) {
  return (
    <Draggable {...draggableProps}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(className)}
        >
          {children}
        </div>
      )}
    </Draggable>
  );
}

export default DraggableItem;
