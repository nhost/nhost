import { PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { type Path, useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import type { AssistantFormValues } from '@/features/orgs/projects/ai/AssistantForm/AssistantForm';
import { ArgumentsFormSection } from '@/features/orgs/projects/ai/AssistantForm/components/ArgumentsFormSection';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

type AssistantFormPath = Path<AssistantFormValues>;

export default function WebhooksDataSourcesFormSection() {
  const form = useFormContext<AssistantFormValues>();

  const { fields, append, remove } = useFieldArray({
    name: 'webhooks',
  });

  return (
    <div className="space-y-4 rounded border-1">
      <div className="flex flex-row items-center justify-between p-4">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold text-sm+">Webhooks</h4>
          <InfoTooltip>Webhook data sources and tools</InfoTooltip>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add webhook data source"
          onClick={() =>
            append({
              name: '',
              description: '',
              URL: '',
              arguments: [],
            })
          }
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col space-y-4">
            <div className="flex w-full flex-col space-y-4 p-4 pt-0">
              <FormInput
                control={form.control}
                name={`webhooks.${index}.name` as AssistantFormPath}
                label="Name"
                placeholder="Name"
                autoComplete="off"
              />

              <FormTextarea
                control={form.control}
                name={`webhooks.${index}.description` as AssistantFormPath}
                label="Description"
                placeholder="Description"
                autoComplete="off"
                className="min-h-10 resize-y"
              />

              <FormTextarea
                control={form.control}
                name={`webhooks.${index}.URL` as AssistantFormPath}
                label="URL"
                placeholder="URL"
                autoComplete="off"
                className="min-h-10 resize-y"
              />

              <ArgumentsFormSection nestedField="webhooks" nestIndex={index} />

              <Button
                type="button"
                variant="ghost"
                className="h-10 self-end text-destructive hover:text-destructive"
                aria-label="Remove webhook data source"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>

            {index < fields.length - 1 && <Separator className="h-px" />}
          </div>
        ))}
      </div>
    </div>
  );
}
