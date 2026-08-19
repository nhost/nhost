import { useFormContext, useWatch } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { FieldArrayInputProps } from './ColumnEditorRow';
import { GeneratedBadge } from './GeneratedBadge';

export function NameInput({
  index,
  schema,
}: FieldArrayInputProps & { schema?: string }) {
  const { control, clearErrors, setValue, getValues } = useFormContext();
  // At onChange time the store already holds the new name (FormInput fires it
  // after the field's own onChange); this render's value is the previous name.
  const renderedName: string = useWatch({ name: `columns.${index}.name` });

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
        const previousName = renderedName;
        const newColumnName = event.target.value;

        if (previousName === newColumnName) {
          return;
        }

        const foreignKeyRelations: ForeignKeyRelation[] =
          getValues('foreignKeyRelations') ?? [];

        const tableName = getValues('name') as string | undefined;
        foreignKeyRelations.forEach((relation, relationIndex) => {
          if (relation.columns.includes(previousName)) {
            setValue(
              `foreignKeyRelations.${relationIndex}.columns`,
              relation.columns.map((column) =>
                column === previousName ? newColumnName : column,
              ),
            );
          }

          const isSelfReference =
            !!tableName &&
            (relation.referencedSchema || schema) === schema &&
            relation.referencedTable === tableName;
          if (
            isSelfReference &&
            relation.referencedColumns.includes(previousName)
          ) {
            setValue(
              `foreignKeyRelations.${relationIndex}.referencedColumns`,
              relation.referencedColumns.map((column) =>
                column === previousName ? newColumnName : column,
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
