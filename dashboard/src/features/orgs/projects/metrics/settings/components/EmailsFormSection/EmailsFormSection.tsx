import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function EmailsFormSection() {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'emails',
  });

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Email
          </Text>
          <Tooltip
            title={
              <span>
                Select your preferred emails for receiving notifications when
                your alert rules are firing.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button variant="borderless" onClick={() => append({ email: '' })}>
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      {fields?.length > 0 ? (
        <Box className="flex flex-col gap-6">
          {fields.map((field, index) => (
            <Box key={field.id} className="flex w-full items-center gap-2">
              <Input
                {...register(`emails.${index}.email`)}
                id={`${field.id}-email`}
                placeholder="Enter email address"
                className="w-full"
                label={`Email #${index + 1}`}
                hideEmptyHelperText
                error={!!errors?.emails?.[index]?.email}
                helperText={errors?.emails?.[index]?.email?.message}
                fullWidth
                autoComplete="off"
              />
              <Button
                variant="borderless"
                className="h-10 self-end"
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
