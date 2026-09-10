import { Plus } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import type { BaseForeignKeyFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';
import ForeignKeyEditorRow from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ForeignKeyEditorRow';
import { getFormCandidateKeys } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/getFormCandidateKeys';
import { CreateForeignKeyForm } from '@/features/orgs/projects/database/dataGrid/components/CreateForeignKeyForm';
import { EditForeignKeyForm } from '@/features/orgs/projects/database/dataGrid/components/EditForeignKeyForm';
import type {
  DatabaseColumn,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

export interface ForeignKeyEditorSectionProps {
  /** Additional complete local key sets, such as standalone unique indexes. */
  constraintColumnSets?: string[][];
}

export function validateForeignKeyRelationCollision(
  values: BaseForeignKeyFormValues,
  relations: ForeignKeyRelation[],
  excludedIndex?: number,
): void {
  const candidateSignature = getForeignKeyPairSignature(
    values.columns,
    values.referencedColumns,
  );

  if (!candidateSignature) {
    throw new Error('Foreign key mappings must be complete and unambiguous.');
  }

  const isRelationDuplicate = relations.some(
    (relation, relationIndex) =>
      relationIndex !== excludedIndex &&
      values.referencedSchema === relation.referencedSchema &&
      values.referencedTable === relation.referencedTable &&
      getForeignKeyPairSignature(
        relation.columns,
        relation.referencedColumns,
      ) === candidateSignature,
  );

  if (!isRelationDuplicate) {
    return;
  }

  const pairs = values.columns
    .map((column, index) => `${column} → ${values.referencedColumns[index]}`)
    .join(', ');

  throw new Error(
    `This foreign key relation already exists: ${pairs} (${values.referencedSchema}.${values.referencedTable})`,
  );
}

export default function ForeignKeyEditorSection({
  constraintColumnSets,
}: ForeignKeyEditorSectionProps) {
  const { fields, append, remove, update } = useFieldArray({
    name: 'foreignKeyRelations',
    keyName: 'fieldId',
  });
  const { openDialog } = useDialog();
  const { getValues } = useFormContext();
  const columns: DatabaseColumn[] = useWatch({ name: 'columns' }) ?? [];
  const columnsWithNameAndType = columns?.filter(
    (column) => !!column.name && !!column.type,
  );

  function handleEdit(values: BaseForeignKeyFormValues, index: number) {
    validateForeignKeyRelationCollision(
      values,
      getValues('foreignKeyRelations') ?? [],
      index,
    );
    update(index, values);
  }

  function handleCreate(values: BaseForeignKeyFormValues) {
    validateForeignKeyRelationCollision(
      values,
      getValues('foreignKeyRelations') ?? [],
    );
    append(values);
  }

  function getDialogFormProps() {
    const formColumns: DatabaseColumn[] = getValues('columns') ?? [];
    const primaryKeyIndices: string[] = getValues('primaryKeyIndices') ?? [];
    const uniqueConstraints = getValues('uniqueConstraints') ?? [];
    const tableName = getValues('name') as string;

    const draftCandidateKeys = getFormCandidateKeys({
      tableName,
      columns: formColumns,
      primaryKeyIndices,
      uniqueConstraints,
    });
    const currentColumnNames = new Set(formColumns.map(({ name }) => name));
    const currentNameByOriginalName = new Map(
      formColumns.flatMap((column) =>
        column.id ? ([[column.id, column.name]] as const) : [],
      ),
    );
    const remappedConstraintColumnSets = (constraintColumnSets ?? []).flatMap(
      (columnSet) => {
        const remapped = columnSet.map(
          (columnName) =>
            currentNameByOriginalName.get(columnName) ?? columnName,
        );
        return remapped.every((columnName) =>
          currentColumnNames.has(columnName),
        )
          ? [remapped]
          : [];
      },
    );

    return {
      availableColumns: formColumns,
      constraintColumnSets: [
        ...draftCandidateKeys.map(({ columns: candidateColumns }) =>
          Array.from(candidateColumns),
        ),
        ...remappedConstraintColumnSets,
      ],
    };
  }

  return (
    <section className="grid grid-flow-row gap-2 px-6">
      {fields?.map((field, index) => (
        <ForeignKeyEditorRow
          index={index}
          onEdit={() => {
            const foreignKeyRelations: ForeignKeyRelation[] =
              getValues('foreignKeyRelations') ?? [];
            openDialog({
              title: 'Edit Foreign Key Relation',
              props: {
                PaperProps: { className: 'max-w-xl w-full overflow-hidden' },
              },
              component: (
                <EditForeignKeyForm
                  foreignKeyRelation={foreignKeyRelations[index]}
                  {...getDialogFormProps()}
                  onSubmit={(values) => handleEdit(values, index)}
                />
              ),
            });
          }}
          onDelete={() => remove(index)}
          key={field.fieldId}
        />
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={twMerge(
          'mt-1 gap-2 rounded-sm+ py-2 text-primary hover:text-primary',
          fields.length === 0 && 'border border-input',
          fields.length > 0 && 'justify-self-start',
        )}
        disabled={columnsWithNameAndType?.length === 0}
        onClick={() => {
          openDialog({
            title: (
              <span className="grid grid-flow-row">
                <span>Add a Foreign Key Relation</span>

                <span className="text-muted-foreground text-sm">
                  Foreign keys help ensure the referential integrity of your
                  data.
                </span>
              </span>
            ),
            props: {
              PaperProps: { className: 'max-w-xl w-full overflow-hidden' },
            },
            component: (
              <CreateForeignKeyForm
                {...getDialogFormProps()}
                onSubmit={handleCreate}
              />
            ),
          });
        }}
      >
        <Plus className="h-4 w-4" />
        Add Foreign Key
      </Button>
    </section>
  );
}
