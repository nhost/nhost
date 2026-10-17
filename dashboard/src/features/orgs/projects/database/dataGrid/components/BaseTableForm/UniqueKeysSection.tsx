import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/v3/multi-select';
import { POSTGRESQL_MAX_IDENTIFIER_LENGTH } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants/postgresqlConstants';
import { areStrArraysEqualOrdered } from '@/lib/utils';
import type { BaseTableFormValues } from './BaseTableForm';

type UniqueKey = NonNullable<BaseTableFormValues['uniqueKeys']>[number];

const displayName = ({ name, newName }: UniqueKey) => name ?? newName;

interface UniqueKeyDialogValues {
  name: string;
  columnIndices: string[];
}

interface UniqueKeyDialogProps {
  columnNames: string[];
  defaultValues: UniqueKeyDialogValues;
  submitButtonText: string;
  onSubmit?: (values: UniqueKeyDialogValues) => void;
  onCancel?: VoidFunction;
}

function UniqueKeyDialog({
  columnNames,
  defaultValues,
  submitButtonText,
  onSubmit,
  onCancel,
}: UniqueKeyDialogProps) {
  const [name, setName] = useState(defaultValues.name);
  const [columnIndices, setColumnIndices] = useState(
    defaultValues.columnIndices,
  );

  return (
    <div className="grid gap-4 border-t-1 px-6 py-4">
      <div className="grid gap-2">
        <span className="font-medium text-sm">Name (optional)</span>
        <Input
          aria-label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Leave empty to let Postgres name it"
          maxLength={POSTGRESQL_MAX_IDENTIFIER_LENGTH}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-2">
        <span className="font-medium text-sm">Columns</span>
        <MultiSelect values={columnIndices} onValuesChange={setColumnIndices}>
          <MultiSelectTrigger aria-label="Columns" className="h-10 w-full">
            <MultiSelectValue placeholder="Select columns" />
          </MultiSelectTrigger>
          <MultiSelectContent contentClassName="z-[1400]">
            <MultiSelectGroup>
              {columnNames.map(
                (columnName, index) =>
                  columnName && (
                    <MultiSelectItem key={columnName} value={`${index}`}>
                      {columnName}
                    </MultiSelectItem>
                  ),
              )}
            </MultiSelectGroup>
          </MultiSelectContent>
        </MultiSelect>
      </div>

      <Button
        type="button"
        disabled={columnIndices.length < 2}
        onClick={() => onSubmit?.({ name, columnIndices })}
      >
        {submitButtonText}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export default function UniqueKeysSection() {
  const { control } = useFormContext<BaseTableFormValues>();
  const columns = useWatch({ control, name: 'columns' });
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: 'uniqueKeys',
  });
  const { openDialog } = useDialog();
  const columnNames = columns.map(({ name }) => name);

  function openUniqueKeyDialog(index?: number) {
    const uniqueKey = index === undefined ? undefined : fields[index];

    openDialog({
      title: (
        <span className="grid grid-flow-row">
          <span>{uniqueKey ? 'Edit' : 'Add a'} Unique Constraint</span>
          <span className="text-muted-foreground text-sm">
            Pick two or more columns. For a single column, use its Unique
            checkbox.
          </span>
        </span>
      ),
      props: { PaperProps: { className: 'max-w-xl' } },
      component: (
        <UniqueKeyDialog
          columnNames={columnNames}
          defaultValues={{
            name: (uniqueKey && displayName(uniqueKey)) ?? '',
            columnIndices: uniqueKey?.columnIndices ?? [],
          }}
          submitButtonText={uniqueKey ? 'Save' : 'Add'}
          onSubmit={({ name, columnIndices }) => {
            const newName = name.trim() || undefined;

            if (index === undefined) {
              append({ newName, columnIndices });
            } else if (
              newName !== displayName(fields[index]) ||
              !areStrArraysEqualOrdered(
                columnIndices,
                fields[index].columnIndices,
              )
            ) {
              // Without `name` the old constraint is dropped and this one added.
              update(index, { newName, columnIndices });
            }
          }}
        />
      ),
    });
  }

  return (
    <section className="grid grid-flow-row gap-2 px-6">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="box grid grid-flow-col items-center justify-between gap-2 rounded-sm+ border-1 px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <KeyRound className="h-4 w-4 flex-none" />
            <div className="min-w-0">
              {displayName(field) && (
                <p className="m-0 truncate font-medium">{displayName(field)}</p>
              )}
              <p
                className={twMerge(
                  'm-0 truncate',
                  displayName(field)
                    ? 'text-muted-foreground text-sm'
                    : 'font-medium',
                )}
              >
                {field.columnIndices.map((i) => columnNames[+i]).join(', ')}
              </p>
            </div>
          </div>

          <div className="grid grid-flow-col">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-primary hover:text-primary"
              onClick={() => openUniqueKeyDialog(index)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-primary hover:text-primary"
              onClick={() => remove(index)}
            >
              Delete
            </Button>
          </div>
        </div>
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
        disabled={columnNames.filter(Boolean).length < 2}
        onClick={() => openUniqueKeyDialog()}
      >
        <Plus className="h-4 w-4" />
        Add Unique Constraint
      </Button>
    </section>
  );
}
