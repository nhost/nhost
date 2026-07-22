import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';

export default function EnvironmentFormSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();

  const [focusedInput, setFocusedInput] = useState<string | null>(null);

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
            <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
          </Tooltip>
        </Box>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add environment variable"
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
                error={!!errors?.environment?.at?.(index)}
                helperText={errors?.environment?.at?.(index)?.message}
                fullWidth
                autoComplete="off"
              />
              <Input
                {...register(`environment.${index}.value`)}
                id={`${field.id}-value`}
                placeholder={`Value ${index}`}
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.environment?.at?.(index)}
                helperText={errors?.environment?.at?.(index)?.message}
                fullWidth
                autoComplete="off"
                multiline
                maxRows={focusedInput === `${field.id}-value` ? 1000 : 1}
                onFocusCapture={() => setFocusedInput(`${field.id}-value`)}
                onBlurCapture={() => setFocusedInput(null)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label="Remove environment variable"
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
