import { X } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import type { BaseTableFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/BaseTableForm';
import { isSelfReferencingRelation } from '@/features/orgs/projects/database/dataGrid/utils/isSelfReferencingRelation';
import type { FieldArrayInputProps } from './ColumnEditorRow';

export interface RemoveButtonProps extends FieldArrayInputProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  schema?: string;
}

export function RemoveButton({ index, onClick, schema }: RemoveButtonProps) {
  const { control, getValues, setValue } =
    useFormContext<BaseTableFormValues>();
  const foreignKeyRelations =
    useWatch({ control, name: 'foreignKeyRelations' }) ?? [];
  const columns = useWatch({ control, name: 'columns' });
  const primaryKeyIndices = useWatch({ control, name: 'primaryKeyIndices' });
  const identityColumnIndex = useWatch({
    control,
    name: 'identityColumnIndex',
  });

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

        const removedColumnName = columns[index].name;
        const tableName = getValues('name');
        const remainingRelations = foreignKeyRelations.filter((relation) => {
          const isSelfReference =
            !!tableName &&
            isSelfReferencingRelation(relation, schema, tableName);

          return (
            !relation.columns.includes(removedColumnName) &&
            (!isSelfReference ||
              !relation.referencedColumns.includes(removedColumnName))
          );
        });
        if (remainingRelations.length !== foreignKeyRelations.length) {
          setValue('foreignKeyRelations', remainingRelations);
        }

        const removedColumnReference = columns[index].formReference;
        if (removedColumnReference) {
          const uniqueConstraints = getValues('uniqueConstraints') ?? [];
          const remainingUniqueConstraints = uniqueConstraints.filter(
            ({ columnReferences }) =>
              !columnReferences.includes(removedColumnReference),
          );

          if (remainingUniqueConstraints.length !== uniqueConstraints.length) {
            setValue('uniqueConstraints', remainingUniqueConstraints, {
              shouldDirty: true,
            });
          }
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
