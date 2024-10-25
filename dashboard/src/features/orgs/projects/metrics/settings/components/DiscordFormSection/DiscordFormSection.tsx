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

export default function DiscordFormSection() {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'discord',
  });

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Discord
          </Text>
          <Tooltip
            title={
              <span>
                Receive alert notifications in your Discord channels when your
                Grafana alert rules are triggered and resolved.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() => append({ url: '', avatarUrl: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>
      {fields?.length > 0 ? (
        <Box className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <Box key={field.id} className="flex w-full items-center gap-2">
              <Box className="flex flex-1 flex-col gap-2">
                <Input
                  {...register(`discord.${index}.url`)}
                  id={`${field.id}-discord`}
                  label="Discord URL"
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full"
                  hideEmptyHelperText
                  error={!!errors?.discord?.[index]?.url}
                  helperText={errors?.discord?.[index]?.url?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`discord.${index}.avatarUrl`)}
                  id={`${field.id}-discord-avatar`}
                  label="Avatar URL"
                  placeholder="https://discord.com/api/avatar/..."
                  className="w-full"
                  hideEmptyHelperText
                  error={!!errors?.discord?.[index]?.avatarUrl}
                  helperText={errors?.discord?.[index]?.avatarUrl?.message}
                  fullWidth
                  autoComplete="off"
                />
              </Box>
              <Button
                variant="borderless"
                className=""
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
