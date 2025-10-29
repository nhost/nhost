import { Button } from '@/components/ui/v2/Button';
import { HelperText } from '@/components/ui/v2/HelperText';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { Text } from '@/components/ui/v2/Text';
import { useFieldArray, useFormState } from 'react-hook-form';
import { ColumnEditorRow } from './ColumnEditorRow';

function ColumnErrorMessage() {
  const { errors } = useFormState({ name: 'columns' });

  if (typeof errors?.columns?.root?.message === 'string') {
    return (
      <HelperText className="mt-2" error>
        {errors.columns.root.message}
      </HelperText>
    );
  }

  return null;
}

export default function ColumnEditorTable() {
  const { fields, append, remove } = useFieldArray({ name: 'columns' });

  return (
    <>
      <div
        role="table"
        className="col-span-8 overflow-x-auto min-[900px]:overflow-x-visible"
      >
        <div className="sticky top-0 z-10 flex w-full gap-2 pb-2 pt-1">
          <div role="columnheader" className="w-52 flex-none">
            <InputLabel as="span">
              Name
              <Text component="span" color="error">
                *
              </Text>
            </InputLabel>
          </div>

          <div role="columnheader" className="w-52 flex-none">
            <InputLabel as="span">
              Type
              <Text component="span" color="error">
                *
              </Text>
            </InputLabel>
          </div>

          <div role="columnheader" className="w-52 flex-none">
            <InputLabel as="span">Default Value</InputLabel>
          </div>
          <div role="columnheader" className="w-8 flex-none">
            <InputLabel as="span" className="hidden">
              Comment
            </InputLabel>
          </div>

          <div role="columnheader" className="w-13 flex-none text-center">
            <InputLabel as="span" className="truncate">
              Nullable
            </InputLabel>
          </div>

          <div role="columnheader" className="w-13 flex-none text-center">
            <InputLabel as="span" className="truncate">
              Unique
            </InputLabel>
          </div>
          <div className="flex w-9 flex-auto" />
        </div>

        <div role="rowgroup" className="grid w-full grid-flow-row gap-1">
          {fields.map((field, index) => (
            <ColumnEditorRow key={field.id} index={index} remove={remove} />
          ))}
        </div>

        <ColumnErrorMessage />
      </div>

      <div className="col-span-8 py-3">
        <Button
          variant="borderless"
          onClick={() =>
            append({
              name: '',
              type: null,
              defaultValue: null,
              isNullable: false,
              isUnique: false,
              isIdentity: false,
              comment: null,
            })
          }
          startIcon={<PlusIcon />}
          size="small"
        >
          Add Column
        </Button>
      </div>
    </>
  );
}
