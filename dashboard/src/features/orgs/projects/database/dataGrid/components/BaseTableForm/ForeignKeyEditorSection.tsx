import { Plus } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import type { BaseForeignKeyFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';
import { CreateForeignKeyForm } from '@/features/orgs/projects/database/dataGrid/components/CreateForeignKeyForm';
import { EditForeignKeyForm } from '@/features/orgs/projects/database/dataGrid/components/EditForeignKeyForm';
import type {
  DatabaseColumn,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
import ForeignKeyEditorRow from './ForeignKeyEditorRow';

export interface ForeignKeyEditorSectionProps {
  /** Primary key / unique constraint column sets, forwarded to the foreign key dialogs. */
  constraintColumnSets?: string[][];
}

export default function ForeignKeyEditorSection({
  constraintColumnSets,
}: ForeignKeyEditorSectionProps) {
  const { fields, append, remove, update } = useFieldArray({
    name: 'foreignKeyRelations',
  });
  const { openDialog } = useDialog();
  const { getValues } = useFormContext();
  const columns: DatabaseColumn[] = useWatch({ name: 'columns' });
  const columnsWithNameAndType = columns?.filter(
    (column) => !!column.name && !!column.type,
  );

  function validateDuplicateRelation(values: BaseForeignKeyFormValues) {
    const candidateSignature = getForeignKeyPairSignature(
      values.columns,
      values.referencedColumns,
    );

    const isRelationDuplicate = fields.some((field) => {
      const fk = field as unknown as ForeignKeyRelation;

      return (
        values.referencedSchema === fk.referencedSchema &&
        values.referencedTable === fk.referencedTable &&
        getForeignKeyPairSignature(fk.columns, fk.referencedColumns) ===
          candidateSignature &&
        values.id !== fk.id
      );
    });

    if (isRelationDuplicate) {
      const pairs = values.columns
        .map(
          (column, index) => `${column} → ${values.referencedColumns[index]}`,
        )
        .join(', ');

      throw new Error(
        `This foreign key relation already exists: ${pairs} (${values.referencedSchema}.${values.referencedTable})`,
      );
    }
  }

  function handleEdit(values: BaseForeignKeyFormValues, index: number) {
    validateDuplicateRelation(values);
    update(index, values);
  }

  function handleCreate(values: BaseForeignKeyFormValues) {
    validateDuplicateRelation(values);
    append(values);
  }
  const primaryKeyIndices = getValues('primaryKeyIndices');

  return (
    <section className="grid grid-flow-row gap-2 px-6">
      {fields?.map((field, index) => (
        <ForeignKeyEditorRow
          index={index}
          onEdit={() => {
            openDialog({
              title: 'Edit Foreign Key Relation',
              props: {
                PaperProps: { className: 'max-w-xl w-full overflow-hidden' },
              },
              component: (
                <EditForeignKeyForm
                  foreignKeyRelation={fields[index] as ForeignKeyRelation}
                  availableColumns={columns.map((column, columnIndex) =>
                    primaryKeyIndices.includes(`${columnIndex}`)
                      ? { ...column, isPrimary: true }
                      : column,
                  )}
                  constraintColumnSets={constraintColumnSets}
                  onSubmit={(values) => handleEdit(values, index)}
                />
              ),
            });
          }}
          onDelete={() => remove(index)}
          key={field.id}
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
                availableColumns={columns.map((column, index) =>
                  primaryKeyIndices.includes(`${index}`)
                    ? { ...column, isPrimary: true }
                    : column,
                )}
                constraintColumnSets={constraintColumnSets}
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
