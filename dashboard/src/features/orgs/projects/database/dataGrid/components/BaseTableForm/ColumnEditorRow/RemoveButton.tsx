import type { ButtonProps } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useFormContext, useWatch } from 'react-hook-form';
import type { FieldArrayInputProps } from './ColumnEditorRow';

export function RemoveButton({
  index,
  onClick,
}: FieldArrayInputProps & ButtonProps) {
  const { setValue } = useFormContext();
  const foreignKeyRelations: ForeignKeyRelation[] = useWatch({
    name: 'foreignKeyRelations',
  });
  const columns = useWatch({ name: 'columns' });
  const primaryKeyIndices = useWatch({ name: 'primaryKeyIndices' }) as string[];
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });

  return (
    <IconButton
      variant="outlined"
      color="secondary"
      size="small"
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
      <XIcon className="h-4 w-4" />
    </IconButton>
  );
}
