import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
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
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
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

                <Select
                  fullWidth
                  value={formValues.pagerduty.at(index)?.severity || ''}
                  className="lg:col-span-2"
                  label="Severity"
                  onChange={(_event, inputValue) =>
                    onChangeSeverity(inputValue as string, index)
                  }
                  placeholder="Select severity"
                  slotProps={{
                    listbox: { className: 'min-w-0 w-full' },
                    popper: {
                      disablePortal: false,
                      className: 'z-[10000] w-[270px]',
                    },
                  }}
                >
                  {Object.values(EventSeverity).map((severity) => (
                    <Option key={severity} value={severity}>
                      {severity}
                    </Option>
                  ))}
                </Select>

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
