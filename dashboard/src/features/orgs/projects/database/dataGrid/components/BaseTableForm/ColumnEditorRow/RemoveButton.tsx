import { X } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import type {
  DatabaseColumn,
  ForeignKeyRelation,
  FormUniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isSelfReferencingRelation } from '@/features/orgs/projects/database/dataGrid/utils/isSelfReferencingRelation';
import type { FieldArrayInputProps } from './ColumnEditorRow';

export interface RemoveButtonProps extends FieldArrayInputProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  schema?: string;
}

export function RemoveButton({ index, onClick, schema }: RemoveButtonProps) {
  const { getValues, setValue } = useFormContext();
  const foreignKeyRelations: ForeignKeyRelation[] = useWatch({
    name: 'foreignKeyRelations',
  });
  const columns = useWatch({ name: 'columns' }) as DatabaseColumn[];
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

        const removedColumnName = columns[index].name;
        const tableName = getValues('name') as string | undefined;
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
          const uniqueConstraints = (getValues('uniqueConstraints') ??
            []) as FormUniqueConstraint[];
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
