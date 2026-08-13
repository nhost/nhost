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

export default function DiscordFormSection() {
  const { control } = useFormContext<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'discord',
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h3 className="font-semibold">Discord</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              <span>
                Receive alert notifications in your Discord channels when your
                Grafana alert rules are triggered and resolved.
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add Discord webhook"
          onClick={() => append({ url: '', avatarUrl: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>
      {fields?.length > 0 ? (
        <div className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <div key={field.id} className="flex w-full items-center gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <FormInput
                  control={control}
                  name={`discord.${index}.url`}
                  label="Discord URL"
                  placeholder="https://discord.com/api/webhooks/..."
                  containerClassName="w-full"
                  autoComplete="off"
                />
                <FormInput
                  control={control}
                  name={`discord.${index}.avatarUrl`}
                  label="Avatar URL"
                  placeholder="https://discord.com/api/avatar/..."
                  containerClassName="w-full"
                  autoComplete="off"
                />
              </div>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label="Remove Discord webhook"
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
