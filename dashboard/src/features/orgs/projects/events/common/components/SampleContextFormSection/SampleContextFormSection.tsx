import { Plus, Trash } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { Button } from '@/components/ui/v3/button';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

interface SampleContextFormValues {
  sampleContext: Array<{
    key: string;
    value: string;
  }>;
}

export default function SampleContextFormSection() {
  const form = useFormContext<SampleContextFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sampleContext',
  });

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <h3 className="font-medium text-foreground text-sm">
            Sample Context
          </h3>
          <p className="text-muted-foreground text-sm">
            <InfoTooltip>
              <p>
                Mock environment variables to be used during the test execution.
              </p>
            </InfoTooltip>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-4 text-primary hover:bg-muted hover:text-primary"
          onClick={() => append({ key: '', value: '' })}
          data-testid="add-sample-context-button"
        >
          <Plus className="size-5" />
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {fields.length > 0 && (
          <div className="grid grid-cols-9 gap-2 text-foreground text-sm+">
            <span className="col-span-4">Key</span>
            <span className="col-span-4 col-start-6">Value</span>
          </div>
        )}
        {fields.map((fieldItem, index) => (
          <div
            key={fieldItem.id}
            className="grid grid-cols-9 items-center gap-2"
          >
            <div className="col-span-4 self-start">
              <FormInput
                control={form.control}
                name={`sampleContext.${index}.key`}
                label=""
                placeholder="Key"
                className="text-foreground"
                autoComplete="off"
              />
            </div>
            <div className="flex h-10 items-center justify-center self-start">
              <span className="text-center text-foreground">:</span>
            </div>
            <div className="col-span-3 flex items-center self-start">
              <div className="flex-1">
                <FormInput
                  control={form.control}
                  name={`sampleContext.${index}.value`}
                  label=""
                  placeholder="Value"
                  className="text-foreground"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex h-10 items-center justify-end self-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(index)}
              >
                <Trash className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
