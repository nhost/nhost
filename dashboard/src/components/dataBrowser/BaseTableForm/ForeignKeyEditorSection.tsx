import { useDialog } from '@/components/common/DialogProvider';
import type { BaseForeignKeyFormValues } from '@/components/dataBrowser/BaseForeignKeyForm';
import type { DatabaseColumn, ForeignKeyRelation } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import InputLabel from '@/ui/v2/InputLabel';
import Text from '@/ui/v2/Text';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
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

  return (
    <section className="grid grid-flow-row gap-2 px-6">
      <InputLabel as="h3" className="mb-2">
        Foreign Keys
      </InputLabel>

      {fields?.map((field, index) => (
        <ForeignKeyEditorRow
          index={index}
          onEdit={() => {
            const primaryKeyIndex = getValues('primaryKeyIndex');

            openDialog('EDIT_FOREIGN_KEY', {
              title: 'Edit Foreign Key Relation',
              payload: {
                foreignKeyRelation: fields[index],
                availableColumns: columns.map((column, columnIndex) =>
                  columnIndex === primaryKeyIndex
                    ? { ...column, isPrimary: true }
                    : column,
                ),
                onSubmit: (values: BaseForeignKeyFormValues) =>
                  handleEdit(values, index),
              },
            });
          }}
          onDelete={() => remove(index)}
          key={field.id}
        />
      ))}

      <Button
        variant="borderless"
        startIcon={<PlusIcon />}
        size="small"
        className={twMerge(
          'mt-1 rounded-sm+ py-2',
          fields.length > 0 && 'justify-self-start',
        )}
        sx={{
          border: (theme) =>
            fields.length === 0
              ? `1px solid ${theme.palette.grey[300]}`
              : 'none',
        }}
        disabled={columnsWithNameAndType?.length === 0}
        onClick={() => {
          const primaryKeyIndex = getValues('primaryKeyIndex');

          openDialog('CREATE_FOREIGN_KEY', {
            title: (
              <span className="grid grid-flow-row">
                <span>Add a Foreign Key Relation</span>

                <Text variant="subtitle1" component="span">
                  Foreign keys help ensure the referential integrity of your
                  data.
                </Text>
              </span>
            ),
            payload: {
              availableColumns: columns.map((column, index) =>
                index === primaryKeyIndex
                  ? { ...column, isPrimary: true }
                  : column,
              ),
              onSubmit: handleCreate,
            },
          });
        }}
      >
        Add Foreign Key
      </Button>
    </section>
  );
}
