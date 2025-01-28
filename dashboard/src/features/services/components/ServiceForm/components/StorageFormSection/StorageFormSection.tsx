import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import {
  MAX_STORAGE_CAPACITY,
  MIN_STORAGE_CAPACITY,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function StorageFormSection() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();

  const { fields, append, remove } = useFieldArray({
    name: 'storage',
  });

  const checkBounds = (value: string, index: number) => {
    const storageCapacity = parseInt(value, 10);

    if (Number.isNaN(storageCapacity)) {
      setValue(`storage.${index}.capacity`, 1);
    }

    if (storageCapacity > MAX_STORAGE_CAPACITY) {
      setValue(`storage.${index}.capacity`, MAX_STORAGE_CAPACITY);
    }

    if (storageCapacity < MIN_STORAGE_CAPACITY) {
      setValue(`storage.${index}.capacity`, MIN_STORAGE_CAPACITY);
    }
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Storage
          </Text>

          <Tooltip
            title={
              <span>
                By default, services do not have persistent storage. You can add
                SSD disks to the service here. It is important to note that
                capacity can not be decreased after creation, only expanded.
                Refer to{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://docs.nhost.io/guides/run/resources#storage"
                  className="underline"
                >
                  Storage
                </a>{' '}
                for more information.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>

        <Button
          variant="borderless"
          onClick={() => append({ name: '', capacity: 1, path: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box
            key={field.id}
            className="flex w-full flex-col space-y-2 xs+:flex-row xs+:space-x-2 xs+:space-y-0"
          >
            <Input
              {...register(`storage.${index}.name`)}
              id={`${field.id}-name`}
              label={!index && 'Name'}
              placeholder="Name"
              className="w-full"
              hideEmptyHelperText
              error={!!errors?.storage?.at(index)}
              helperText={errors?.storage?.at(index)?.message}
              fullWidth
              autoComplete="off"
            />

            <Input
              {...register(`storage.${index}.capacity`, {
                onBlur: (event) => checkBounds(event.target.value, index),
              })}
              id={`${field.id}-capacity`}
              label={!index && 'Capacity'}
              type="number"
              placeholder="Capacity"
              className="w-full"
              hideEmptyHelperText
              error={!!errors?.storage?.at(index)}
              helperText={errors?.storage?.at(index)?.message}
              fullWidth
              autoComplete="off"
              endAdornment={
                <Text sx={{ color: 'grey.500' }} className="pr-2">
                  GiB
                </Text>
              }
            />

            <Input
              {...register(`storage.${index}.path`)}
              id={`${field.id}-path`}
              label={!index && 'Path'}
              placeholder="Path"
              className="w-full"
              hideEmptyHelperText
              error={!!errors?.storage?.at(index)}
              helperText={errors?.storage?.at(index)?.message}
              fullWidth
              autoComplete="off"
            />

            <Button
              variant="borderless"
              className=""
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
