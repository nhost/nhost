import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';

export default function EmailsFormSection() {
  const { control } = useFormContext<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'emails',
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h3 className="font-semibold">Email</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              <span>
                Select your preferred emails for receiving notifications when
                your alert rules are firing.
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add email"
          onClick={() => append({ email: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      {fields?.length > 0 ? (
        <div className="flex flex-col gap-6">
          {fields.map((field, index) => (
            <div key={field.id} className="flex w-full items-center gap-2">
              <FormInput
                control={control}
                name={`emails.${index}.email`}
                label={`Email #${index + 1}`}
                placeholder="Enter email address"
                containerClassName="w-full"
                autoComplete="off"
              />
              <Button
                variant="ghost"
                className="h-10 self-end text-destructive hover:text-destructive"
                aria-label="Remove email"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-6 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
