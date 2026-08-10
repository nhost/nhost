import { ArrowRight, Link as LinkIcon } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface ForeignKeyEditorRowProps {
  /**
   * Index of the current foreign key relation.
   */
  index: number;
  /**
   * Function to be called when the edit button is clicked.
   */
  onEdit: VoidFunction;
  /**
   * Function to be called when the delete button is clicked.
   */
  onDelete: VoidFunction;
}

export default function ForeignKeyEditorRow({
  index,
  onEdit,
  onDelete,
}: ForeignKeyEditorRowProps) {
  const foreignKeyRelation: ForeignKeyRelation = useWatch({
    name: `foreignKeyRelations.${index}`,
  });

  return (
    <div className="box grid grid-flow-col items-center justify-between gap-2 rounded-sm+ border-1 px-3 py-1">
      <div className="grid grid-flow-col items-center gap-2">
        <LinkIcon className="h-4 w-4" />

        <p className="m-0 grid grid-flow-col items-center gap-1.5 truncate font-medium">
          <span className="truncate">{foreignKeyRelation.columnName}</span>{' '}
          <ArrowRight className="h-4 w-4" />
          <span className="truncate">
            {foreignKeyRelation.referencedSchema}.
            {foreignKeyRelation.referencedTable}.
            {foreignKeyRelation.referencedColumn}
          </span>
        </p>
      </div>

      <div className="grid grid-flow-col justify-start sm:justify-end">
        <Button
          type="button"
          onClick={onEdit}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-primary hover:text-primary"
        >
          Edit
        </Button>

        <Button
          type="button"
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-primary hover:text-primary"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
