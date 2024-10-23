import { Alert } from '@/components/ui/v2/Alert';
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

export default function SlackFormSection() {
  const {
    control,
    register,
    formState: { errors },
    trigger: triggerValidation,
  } = useFormContext<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'slack',
  });

  const handleRemove = (index: number) => {
    remove(index);
    if (fields?.length === 1) {
      triggerValidation();
    }
  };
  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Slack
          </Text>
          <Tooltip
            title={
              <span>
                Select your preferred Slack channels for receiving notifications
                when your alert rules are firing.
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
              recipient: '',
              token: '',
              username: '',
              iconEmoji: '',
              iconURL: '',
              mentionGroups: '',
              mentionUsers: '',
              mentionChannel: '',
              url: '',
              endpointURL: '',
            })
          }
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>
      {fields?.length > 0 ? (
        <Box className="flex flex-col gap-12">
          {!!errors?.slack?.root?.message && (
            <Alert severity="error" className="w-full">
              {errors?.slack?.root?.message}
            </Alert>
          )}
          {fields.map((field, index) => (
            <Box key={field.id} className="flex w-full items-center gap-2">
              <Box className="grid flex-grow gap-4 lg:grid-cols-9">
                <Input
                  {...register(`slack.${index}.recipient`)}
                  id={`${field.id}-recipient`}
                  placeholder="Enter recipient"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.recipient}
                  helperText={errors?.slack?.[index]?.recipient?.message}
                  fullWidth
                  label="Recipient"
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.token`)}
                  id={`${field.id}-token`}
                  placeholder="Enter Slack API token"
                  label="Token"
                  className="w-full lg:col-span-6"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.token}
                  helperText={errors?.slack?.[index]?.token?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.username`)}
                  id={`${field.id}-username`}
                  placeholder="Enter bot's username"
                  label="Bot Username"
                  className="w-full lg:col-span-5"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.username}
                  helperText={errors?.slack?.[index]?.username?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`slack.${index}.mentionChannel`)}
                  id={`${field.id}-mentionChannel`}
                  placeholder="Enter channel to mention"
                  label="Mention Channel"
                  className="w-full lg:col-span-4"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.mentionChannel}
                  helperText={errors?.slack?.[index]?.mentionChannel?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.mentionUsers`)}
                  id={`${field.id}-mentionUsers`}
                  placeholder="Enter users to mention (separated by commas)"
                  label="Mention Users"
                  className="w-full lg:col-span-9"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.mentionUsers}
                  helperText={errors?.slack?.[index]?.mentionUsers?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.mentionGroups`)}
                  id={`${field.id}-mentionGroups`}
                  placeholder="Enter groups to mention (separated by commas)"
                  label="Mention Groups"
                  className="w-full lg:col-span-9"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.mentionGroups}
                  helperText={errors?.slack?.[index]?.mentionGroups?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.iconEmoji`)}
                  id={`${field.id}-iconEmoji`}
                  placeholder="Enter emoji icon"
                  label="Emoji Icon"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.iconEmoji}
                  helperText={errors?.slack?.[index]?.iconEmoji?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`slack.${index}.iconURL`)}
                  id={`${field.id}-iconURL`}
                  placeholder="Enter emoji icon URL"
                  label="Emoji Icon URL"
                  className="w-full lg:col-span-6"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.iconURL}
                  helperText={errors?.slack?.[index]?.iconURL?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.url`)}
                  id={`${field.id}-url`}
                  placeholder="Enter Slack Webhook URL"
                  label="Slack Webhook URL"
                  className="w-full lg:col-span-9"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.url}
                  helperText={errors?.slack?.[index]?.url?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`slack.${index}.endpointURL`)}
                  id={`${field.id}-endpointURL`}
                  placeholder="Enter endpoint URL"
                  label="Endpoint URL"
                  className="w-full lg:col-span-9"
                  hideEmptyHelperText
                  error={!!errors?.slack?.[index]?.endpointURL}
                  helperText={errors?.slack?.[index]?.endpointURL?.message}
                  fullWidth
                  autoComplete="off"
                />
              </Box>

              <Button
                variant="borderless"
                className=""
                color="error"
                onClick={() => handleRemove(index)}
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
