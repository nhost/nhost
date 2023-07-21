import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function EnvironmentFormSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();

  const { fields, append, remove } = useFieldArray({
    name: 'environment',
  });

  return (
    <Box className="p-4 space-y-4 rounded border-1">
      <Box className="flex flex-row items-center justify-between ">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Environment
          </Text>
          <Tooltip title="Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s">
            <InfoIcon aria-label="Info" className="w-4 h-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() => append({ name: '', value: '' })}
        >
          <PlusIcon className="w-5 h-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box
            key={field.id}
            className="flex w-full flex-col space-y-2 xs+:flex-row xs+:space-y-0 xs+:space-x-2"
          >
            <Input
              {...register(`environment.${index}.name`)}
              id={`${field.id}-name`}
              label={!index && 'Name'}
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
              label={!index && 'Value'}
              placeholder={`Value ${index}`}
              className="w-full"
              hideEmptyHelperText
              error={!!errors?.environment?.at(index)}
              helperText={errors?.environment?.at(index)?.message}
              fullWidth
              autoComplete="off"
            />

            <Button
              variant="borderless"
              className=""
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="w-4 h-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
