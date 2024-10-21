import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { useEffect } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function EmailsFormSection() {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'emails',
  });

  useEffect(() => {
    if (fields.length === 0) {
      append('');
    }
  }, [fields.length, append]);

  return (
    <div className="grid grid-flow-row gap-2">
      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex flex-col space-y-4">
            <Box className="flex w-full flex-row space-y-4 py-4 pt-0">
              <Input
                {...register(`emails.${index}`)}
                id={`${field.id}-email`}
                label="Email"
                placeholder="Email"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.emails?.[index]}
                helperText={errors?.emails?.[index]?.message}
                fullWidth
                autoComplete="off"
              />

              <Button
                variant="borderless"
                className="h-10 self-end"
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </Box>

            {index < fields.length - 1 && (
              <Divider className="h-px" sx={{ background: 'grey.200' }} />
            )}
          </Box>
        ))}
      </Box>
      <Button
        className="justify-self-start"
        variant="borderless"
        startIcon={<PlusIcon />}
        onClick={() => append('')}
      >
        Add a new email
      </Button>
    </div>
  );
}
