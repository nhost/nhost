import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import {
  cronHeaderTypes,
  type BaseCronTriggerFormValues,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useFieldArray, useFormContext } from 'react-hook-form';

interface HeadersSectionProps {
  className?: string;
}

export default function HeadersSection({ className }: HeadersSectionProps) {
  const form = useFormContext<BaseCronTriggerFormValues>();
  const { watch } = form;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'headers',
  });

  const types = watch('headers').map((header) => header.type);

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <h3 className="text-base font-medium text-foreground">
            Additional Headers{' '}
          </h3>
          <p className="text-sm text-muted-foreground">
            <InfoTooltip>
              Custom headers to be sent with the webhook request.
            </InfoTooltip>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-4 text-primary hover:bg-muted hover:text-primary"
          onClick={() => append({ name: '', type: 'fromValue', value: '' })}
        >
          <PlusIcon className="size-5" />
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {fields.length > 0 && (
          <div className="grid grid-flow-row grid-cols-9 text-sm+ text-foreground">
            <span className="col-span-3">Key</span>
            <div className="col-span-1" />
            <span className="col-span-4">Value</span>
          </div>
        )}
        {fields.map((fieldItem, index) => (
          <div
            key={fieldItem.id}
            className="grid grid-flow-row grid-cols-9 items-center gap-2"
          >
            <div className="col-span-3 self-start">
              <FormInput
                control={form.control}
                name={`headers.${index}.name`}
                label=""
                placeholder="Header name"
                className="text-foreground"
                autoComplete="off"
              />
            </div>
            <div className="col-span-1 flex h-10 items-center justify-center self-start pt-2">
              <span className="text-center text-foreground">:</span>
            </div>
            <div className="col-span-4 flex items-center self-start">
              <div className="self-start">
                <FormSelect
                  control={form.control}
                  name={`headers.${index}.type`}
                  label=""
                  placeholder="Select type"
                  className="relative min-w-[120px] max-w-60 rounded-r-none border-r-0 text-foreground focus:z-10"
                >
                  {cronHeaderTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </FormSelect>
              </div>
              <div className="flex-1">
                <FormInput
                  control={form.control}
                  name={`headers.${index}.value`}
                  label=""
                  placeholder={
                    types[index] === 'fromValue'
                      ? 'Header value'
                      : 'Env variable'
                  }
                  className="relative rounded-l-none text-foreground focus:z-10"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="col-span-1 self-start pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(index)}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
