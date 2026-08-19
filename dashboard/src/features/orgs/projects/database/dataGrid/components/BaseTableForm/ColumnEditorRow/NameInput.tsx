import { useFormContext, useWatch } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import type { FieldArrayInputProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ColumnEditorRow/ColumnEditorRow';
import { GeneratedBadge } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ColumnEditorRow/GeneratedBadge';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getSingularForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

export function NameInput({ index }: FieldArrayInputProps) {
  const { control, clearErrors, setValue, getValues } = useFormContext();
  const originalColumnName = getValues(`columns.${index}.name`);
  const foreignKeyRelations: ForeignKeyRelation[] =
    getValues('foreignKeyRelations') ?? [];
  const originalForeignKeyRelationIndex = foreignKeyRelations.findIndex(
    (relation) => relation.columns.includes(originalColumnName),
  );
  const originalForeignKeyRelation =
    foreignKeyRelations[originalForeignKeyRelationIndex];
  const singularRelation = originalForeignKeyRelation
    ? getSingularForeignKeyRelation(originalForeignKeyRelation)
    : null;
  const isCompositeParticipant =
    originalForeignKeyRelation !== undefined && singularRelation === null;

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
      disabled={isCompositeParticipant}
      className="border-border"
      data-testid={`columns.${index}.name`}
      addonEnd={
        isGenerated ? (
          <GeneratedBadge generationExpression={generationExpression} />
        ) : undefined
      }
      onChange={(event) => {
        if (originalForeignKeyRelationIndex > -1 && singularRelation) {
          setValue(
            `foreignKeyRelations.${originalForeignKeyRelationIndex}.columns`,
            [event.target.value],
          );
        }
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
