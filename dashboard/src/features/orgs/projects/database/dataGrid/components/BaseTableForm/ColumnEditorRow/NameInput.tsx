import { useFormContext, useWatch } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { FieldArrayInputProps } from './ColumnEditorRow';
import { GeneratedBadge } from './GeneratedBadge';

export function NameInput({ index }: FieldArrayInputProps) {
  const { control, clearErrors, setValue, getValues } = useFormContext();
  const originalColumnName = getValues(`columns.${index}.name`);
  const foreignKeyRelations: ForeignKeyRelation[] =
    getValues(`foreignKeyRelations`);

  const primaryKeyIndices: string[] = useWatch({ name: 'primaryKeyIndices' });
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });
  const generationExpression = useWatch({
    name: `columns.${index}.generationExpression`,
  });

  return (
    <FormInput
      control={control}
      name={`columns.${index}.name`}
      aria-label="Name"
      placeholder="Enter name"
      autoComplete="off"
      className="border-border"
      data-testid={`columns.${index}.name`}
      addonEnd={
        isGenerated ? (
          <GeneratedBadge generationExpression={generationExpression} />
        ) : undefined
      }
      onChange={(event) => {
        const newColumnName = event.target.value;

        foreignKeyRelations.forEach((relation, relationIndex) => {
          if (relation.columns.includes(originalColumnName)) {
            setValue(
              `foreignKeyRelations.${relationIndex}.columns`,
              relation.columns.map((column) =>
                column === originalColumnName ? newColumnName : column,
              ),
            );
          }
        });
      }}
      onBlur={(event) => {
        clearErrors('columns');
        if (!event.target.value && primaryKeyIndices.includes(`${index}`)) {
          setValue(
            'primaryKeyIndices',
            primaryKeyIndices.filter((pk) => pk !== `${index}`),
          );
        }
      }}
    />
  );
}

export default NameInput;
