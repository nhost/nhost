import { KeyRound } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import getGeneratedUniqueConstraintName from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/getGeneratedUniqueConstraintName';
import type {
  DatabaseColumn,
  FormUniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface UniqueConstraintEditorRowProps {
  index: number;
  onEdit: VoidFunction;
  onDelete: VoidFunction;
}

export default function UniqueConstraintEditorRow({
  index,
  onEdit,
  onDelete,
}: UniqueConstraintEditorRowProps) {
  const constraint = useWatch({
    name: `uniqueConstraints.${index}`,
  }) as FormUniqueConstraint | undefined;
  const columns = (useWatch({ name: 'columns' }) ?? []) as DatabaseColumn[];
  const tableName = (useWatch({ name: 'name' }) ?? '') as string;
  const columnNames = (constraint?.columnReferences ?? []).map((reference) => {
    const column = columns.find(
      ({ formReference }) => formReference === reference,
    );

    return column
      ? column.name || 'Unnamed column'
      : `Missing column (${reference})`;
  });
  const constraintName =
    constraint?.name ||
    getGeneratedUniqueConstraintName(tableName, columnNames);

  return (
    <div className="box grid gap-2 rounded-sm+ border-1 px-3 py-2 sm:grid-flow-col sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <KeyRound className="h-4 w-4 flex-none" />
        <div className="min-w-0">
          <p className="m-0 truncate font-medium">{constraintName}</p>
          <p className="m-0 truncate text-muted-foreground text-sm">
            {columnNames.join(', ')}
          </p>
        </div>
      </div>

      <div className="grid grid-flow-col justify-start sm:justify-end">
        <Button
          type="button"
          onClick={onEdit}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-primary hover:text-primary"
          aria-label={`Edit unique constraint ${constraintName}`}
        >
          Edit
        </Button>
        <Button
          type="button"
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-primary hover:text-primary"
          aria-label={`Delete unique constraint ${constraintName}`}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
