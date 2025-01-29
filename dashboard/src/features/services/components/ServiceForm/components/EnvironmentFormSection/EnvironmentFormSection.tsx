import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function EnvironmentFormSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();

  const [focusedInput, setFocusedInput] = useState<string>(null);

  const { fields, append, remove } = useFieldArray({
    name: 'environment',
  });

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Environment
          </Text>
          <Tooltip
            title={
              <span>
                Environment variables to add to the service. Other than the ones
                specified here only <code>NHOST_SUBDOMAIN</code> and{' '}
                <code>NHOST_REGION</code> are added automatically to the
                service.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() => append({ name: '', value: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex w-full items-center space-x-2">
            <div className="flex w-full flex-col space-y-2">
              <Input
                {...register(`environment.${index}.name`)}
                id={`${field.id}-name`}
                placeholder={`Key ${index}`}
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.environment?.at(index)}
                helperText={errors?.environment?.at(index)?.message}
                fullWidth
                autoComplete="off"
              />
              <Input
                {...register(`environment.${index}.value`)}
                id={`${field.id}-value`}
                placeholder={`Value ${index}`}
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.environment?.at(index)}
                helperText={errors?.environment?.at(index)?.message}
                fullWidth
                autoComplete="off"
                multiline
                maxRows={focusedInput === `${field.id}-value` ? 1000 : 1}
                onFocusCapture={() => setFocusedInput(`${field.id}-value`)}
                onBlurCapture={() => setFocusedInput(null)}
              />
            </div>
            <Button
              variant="borderless"
              className=""
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-6 w-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
