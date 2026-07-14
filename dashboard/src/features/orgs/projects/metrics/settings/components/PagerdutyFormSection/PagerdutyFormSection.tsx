import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';
import { EventSeverity } from './PagerdutyFormSectionTypes';

export default function PagerdutyFormSection() {
  const {
    register,
    formState: { errors },
    setValue,
    control,
  } = useFormContext<ContactPointsFormValues>();
  const formValues = useWatch<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'pagerduty',
  });

  const onChangeSeverity = (value: string | undefined, index: number) =>
    setValue(`pagerduty.${index}.severity`, value as EventSeverity);

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            PagerDuty
          </Text>
          <Tooltip
            title={
              <span>
                Receive notifications in PagerDuty when your alert rules are
                firing.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
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
      </Box>

      {fields?.length > 0 ? (
        <Box className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <Box key={field.id} className="flex w-full items-center gap-2">
              <Box className="grid flex-grow gap-4 lg:grid-cols-9">
                <Input
                  {...register(`pagerduty.${index}.integrationKey`)}
                  id={`${field.id}-integrationKey`}
                  placeholder="Enter PagerDuty Integration Key"
                  className="w-full lg:col-span-7"
                  hideEmptyHelperText
                  error={!!errors?.pagerduty?.[index]?.integrationKey}
                  helperText={
                    errors?.pagerduty?.[index]?.integrationKey?.message
                  }
                  fullWidth
                  label="Integration Key"
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

                <Input
                  {...register(`pagerduty.${index}.class`)}
                  id={`${field.id}-class`}
                  placeholder="Enter type of the event"
                  label="Class"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.pagerduty?.[index]?.class}
                  helperText={errors?.pagerduty?.[index]?.class?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`pagerduty.${index}.component`)}
                  id={`${field.id}-component`}
                  placeholder="Enter component of the event"
                  label="Component"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.pagerduty?.[index]?.component}
                  helperText={errors?.pagerduty?.[index]?.component?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`pagerduty.${index}.group`)}
                  id={`${field.id}-group`}
                  placeholder="Enter logical group of components"
                  label="Group"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.pagerduty?.[index]?.group}
                  helperText={errors?.pagerduty?.[index]?.group?.message}
                  fullWidth
                  autoComplete="off"
                />
              </Box>

              <Button
                variant="borderless"
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-6 w-4" />
              </Button>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
