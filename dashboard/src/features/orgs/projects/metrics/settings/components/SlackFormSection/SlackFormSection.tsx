import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';

export default function SlackFormSection() {
  const {
    control,
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
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h3 className="font-semibold">Slack</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              <span>
                Select your preferred Slack channels for receiving notifications
                when your alert rules are firing.
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add Slack channel"
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
      </div>
      {fields?.length > 0 ? (
        <div className="flex flex-col gap-12">
          {!!errors?.slack?.root?.message && (
            <Alert variant="destructive" className="w-full">
              {errors?.slack?.root?.message}
            </Alert>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="flex w-full items-center gap-2">
              <div className="grid flex-grow gap-4 lg:grid-cols-9">
                <FormInput
                  control={control}
                  name={`slack.${index}.recipient`}
                  label="Recipient"
                  placeholder="Enter recipient"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.token`}
                  label="Token"
                  placeholder="Enter Slack API token"
                  containerClassName="w-full lg:col-span-6"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.username`}
                  label="Bot Username"
                  placeholder="Enter bot's username"
                  containerClassName="w-full lg:col-span-5"
                  autoComplete="off"
                />
                <FormInput
                  control={control}
                  name={`slack.${index}.mentionChannel`}
                  label="Mention Channel"
                  placeholder="Enter channel to mention"
                  containerClassName="w-full lg:col-span-4"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.mentionUsers`}
                  label="Mention Users"
                  placeholder="Enter users to mention (separated by commas)"
                  containerClassName="w-full lg:col-span-9"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.mentionGroups`}
                  label="Mention Groups"
                  placeholder="Enter groups to mention (separated by commas)"
                  containerClassName="w-full lg:col-span-9"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.iconEmoji`}
                  label="Emoji Icon"
                  placeholder="Enter emoji icon"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />
                <FormInput
                  control={control}
                  name={`slack.${index}.iconURL`}
                  label="Emoji Icon URL"
                  placeholder="Enter emoji icon URL"
                  containerClassName="w-full lg:col-span-6"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.url`}
                  label="Slack Webhook URL"
                  placeholder="Enter Slack Webhook URL"
                  containerClassName="w-full lg:col-span-9"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`slack.${index}.endpointURL`}
                  label="Endpoint URL"
                  placeholder="Enter endpoint URL"
                  containerClassName="w-full lg:col-span-9"
                  autoComplete="off"
                />
              </div>

              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label="Remove Slack channel"
                onClick={() => handleRemove(index)}
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
