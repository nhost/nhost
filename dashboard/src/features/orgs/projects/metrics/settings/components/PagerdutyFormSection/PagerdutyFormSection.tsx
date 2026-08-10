import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';
import { EventSeverity } from './PagerdutyFormSectionTypes';

export default function PagerdutyFormSection() {
  const { setValue, control } = useFormContext<ContactPointsFormValues>();
  const formValues = useWatch<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'pagerduty',
  });

  const onChangeSeverity = (value: string | undefined, index: number) =>
    setValue(`pagerduty.${index}.severity`, value as EventSeverity);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h3 className="font-semibold">PagerDuty</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              <span>
                Receive notifications in PagerDuty when your alert rules are
                firing.
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add PagerDuty integration"
          onClick={() =>
            append({
              class: '',
              component: '',
              group: '',
              severity: EventSeverity.CRITICAL,
              integrationKey: '',
            })
          }
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      {fields?.length > 0 ? (
        <div className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <div key={field.id} className="flex w-full items-center gap-2">
              <div className="grid flex-grow gap-4 lg:grid-cols-9">
                <FormInput
                  control={control}
                  name={`pagerduty.${index}.integrationKey`}
                  label="Integration Key"
                  placeholder="Enter PagerDuty Integration Key"
                  containerClassName="w-full lg:col-span-7"
                  autoComplete="off"
                />

                <div className="grid gap-1 lg:col-span-2">
                  <label
                    htmlFor={`${field.id}-severity`}
                    className="font-medium text-sm+"
                  >
                    Severity
                  </label>
                  <Select
                    value={formValues.pagerduty?.at(index)?.severity || ''}
                    onValueChange={(value) => onChangeSeverity(value, index)}
                  >
                    <SelectTrigger id={`${field.id}-severity`}>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000] w-[270px] min-w-0">
                      {Object.values(EventSeverity).map((severity) => (
                        <SelectItem key={severity} value={severity}>
                          {severity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormInput
                  control={control}
                  name={`pagerduty.${index}.class`}
                  label="Class"
                  placeholder="Enter type of the event"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`pagerduty.${index}.component`}
                  label="Component"
                  placeholder="Enter component of the event"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />
                <FormInput
                  control={control}
                  name={`pagerduty.${index}.group`}
                  label="Group"
                  placeholder="Enter logical group of components"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />
              </div>

              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label="Remove PagerDuty integration"
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
