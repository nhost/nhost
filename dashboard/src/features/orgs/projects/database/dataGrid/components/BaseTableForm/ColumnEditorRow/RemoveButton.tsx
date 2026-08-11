import { X } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { FieldArrayInputProps } from './ColumnEditorRow';

export interface RemoveButtonProps extends FieldArrayInputProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function RemoveButton({ index, onClick }: RemoveButtonProps) {
  const { setValue } = useFormContext();
  const foreignKeyRelations: ForeignKeyRelation[] = useWatch({
    name: 'foreignKeyRelations',
  });
  const columns = useWatch({ name: 'columns' });
  const primaryKeyIndices = useWatch({ name: 'primaryKeyIndices' }) as string[];
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-testid={`remove-column-${index}`}
      className="h-9 w-9"
      disabled={columns?.length === 1}
      aria-label="Remove column"
      onClick={(event) => {
        if (onClick) {
          onClick(event);
        }

        const updatedPrimaryKeyIndices = primaryKeyIndices.filter(
          (pkIndex) => +pkIndex !== index,
        );

        setValue('primaryKeyIndices', updatedPrimaryKeyIndices);

        if (
          foreignKeyRelations.find(
            (foreignKeyRelation) =>
              foreignKeyRelation.columnName === columns[index].name,
          )
        ) {
          setValue(
            'foreignKeyRelations',
            foreignKeyRelations.filter(
              (foreignKeyRelation) =>
                foreignKeyRelation.columnName !== columns[index].name,
            ),
          );
        }

        if (identityColumnIndex === index) {
          setValue('identityColumnIndex', null);
        }
      }}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
