import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Textarea } from '@/components/ui/v3/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { cn } from '@/lib/utils';

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
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold">Environment</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Info" className="flex">
                <InfoIcon className="h-4 w-4 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Environment variables to add to the service. Other than the ones
              specified here only NHOST_SUBDOMAIN and NHOST_REGION are added
              automatically to the service.
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add environment variable"
          onClick={() => append({ name: '', value: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => {
          const fieldErrors = errors.environment?.[index];
          const nameError = fieldErrors?.name?.message;
          const valueError = fieldErrors?.value?.message;

          return (
            <div key={field.id} className="flex w-full items-start space-x-2">
              <div className="flex w-full flex-col space-y-2">
                <div className="space-y-1">
                  <Input
                    {...register(`environment.${index}.name`)}
                    id={`${field.id}-name`}
                    placeholder={`Key ${index}`}
                    className={cn({ 'border-destructive': nameError })}
                    aria-invalid={!!nameError}
                    autoComplete="off"
                  />
                  {nameError && (
                    <p className="text-destructive text-sm">{nameError}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Textarea
                    {...register(`environment.${index}.value`)}
                    id={`${field.id}-value`}
                    placeholder={`Value ${index}`}
                    className={cn('min-h-10 resize-y', {
                      'border-destructive': valueError,
                    })}
                    aria-invalid={!!valueError}
                    autoComplete="off"
                    rows={focusedInput === `${field.id}-value` ? 8 : 1}
                    onFocusCapture={() => setFocusedInput(`${field.id}-value`)}
                    onBlurCapture={() => setFocusedInput(null)}
                  />
                  {valueError && (
                    <p className="text-destructive text-sm">{valueError}</p>
                  )}
                </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
