import { PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import {
  MAX_STORAGE_CAPACITY,
  MIN_STORAGE_CAPACITY,
} from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { cn } from '@/lib/utils';

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
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold">Storage</h4>

          <InfoTooltip>
            By default, services do not have persistent storage. You can add SSD
            disks to the service here. It is important to note that capacity can
            not be decreased after creation, only expanded. Refer to{' '}
            <TextLink
              href="https://docs.nhost.io/products/run/resources#storage"
              external
              className="font-medium"
            >
              Storage
            </TextLink>{' '}
            for more information.
          </InfoTooltip>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Add storage"
          onClick={() => append({ name: '', capacity: 1, path: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => {
          const storageErrors = errors.storage?.[index];
          const nameError = storageErrors?.name?.message;
          const capacityError = storageErrors?.capacity?.message;
          const pathError = storageErrors?.path?.message;

          return (
            <div
              key={field.id}
              className="flex w-full xs+:flex-row flex-col xs+:space-x-2 space-y-2 xs+:space-y-0"
            >
              <div className="w-full space-y-1">
                {index === 0 && (
                  <Label htmlFor={`${field.id}-name`}>Name</Label>
                )}
                <Input
                  {...register(`storage.${index}.name`)}
                  id={`${field.id}-name`}
                  placeholder="Name"
                  className={cn({ 'border-destructive': nameError })}
                  aria-invalid={!!nameError}
                  autoComplete="off"
                />
                {nameError && (
                  <p className="text-destructive text-sm">{nameError}</p>
                )}
              </div>

              <div className="w-full space-y-1">
                {index === 0 && (
                  <Label htmlFor={`${field.id}-capacity`}>Capacity</Label>
                )}
                <InputGroup
                  className={cn({ 'border-destructive': capacityError })}
                >
                  <InputGroupInput
                    {...register(`storage.${index}.capacity`, {
                      onBlur: (event) => checkBounds(event.target.value, index),
                    })}
                    id={`${field.id}-capacity`}
                    type="number"
                    placeholder="Capacity"
                    aria-invalid={!!capacityError}
                    autoComplete="off"
                  />
                  <InputGroupAddon align="inline-end">GiB</InputGroupAddon>
                </InputGroup>
                {capacityError && (
                  <p className="text-destructive text-sm">{capacityError}</p>
                )}
              </div>

              <div className="w-full space-y-1">
                {index === 0 && (
                  <Label htmlFor={`${field.id}-path`}>Path</Label>
                )}
                <Input
                  {...register(`storage.${index}.path`)}
                  id={`${field.id}-path`}
                  placeholder="Path"
                  className={cn({ 'border-destructive': pathError })}
                  aria-invalid={!!pathError}
                  autoComplete="off"
                />
                {pathError && (
                  <p className="text-destructive text-sm">{pathError}</p>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label="Remove storage"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
