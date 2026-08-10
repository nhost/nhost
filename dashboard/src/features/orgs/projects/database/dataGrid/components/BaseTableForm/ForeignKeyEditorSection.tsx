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
import ForeignKeyEditorRow from './ForeignKeyEditorRow';

export default function ForeignKeyEditorSection() {
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
    const isRelationDuplicate = fields.some((field) => {
      const {
        id,
        columnName,
        referencedSchema,
        referencedTable,
        referencedColumn,
      } = field as unknown as ForeignKeyRelation;

      return (
        values.columnName === columnName &&
        values.referencedSchema === referencedSchema &&
        values.referencedTable === referencedTable &&
        values.referencedColumn === referencedColumn &&
        values.id !== id
      );
    });

    if (isRelationDuplicate) {
      throw new Error(
        `This foreign key relation already exists: ${values.columnName} → ${values.referencedSchema}.${values.referencedTable}.${values.referencedColumn}`,
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
              component: (
                <EditForeignKeyForm
                  foreignKeyRelation={fields[index] as ForeignKeyRelation}
                  availableColumns={columns.map((column, columnIndex) =>
                    primaryKeyIndices.includes(`${columnIndex}`)
                      ? { ...column, isPrimary: true }
                      : column,
                  )}
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
            component: (
              <CreateForeignKeyForm
                availableColumns={columns.map((column, index) =>
                  primaryKeyIndices.includes(`${index}`)
                    ? { ...column, isPrimary: true }
                    : column,
                )}
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
