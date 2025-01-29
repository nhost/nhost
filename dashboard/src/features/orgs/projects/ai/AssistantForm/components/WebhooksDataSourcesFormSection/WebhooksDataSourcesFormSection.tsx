import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { type AssistantFormValues } from '@/features/orgs/projects/ai/AssistantForm/AssistantForm';
import { ArgumentsFormSection } from '@/features/orgs/projects/ai/AssistantForm/components/ArgumentsFormSection';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function WebhooksDataSourcesFormSection() {
  const form = useFormContext<AssistantFormValues>();

  const {
    register,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: 'webhooks',
  });

  return (
    <Box className="space-y-4 rounded border-1">
      <Box className="flex flex-row items-center justify-between p-4">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Webhooks
          </Text>
          <Tooltip title="Webhook data sources and tools">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
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
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex flex-col space-y-4">
            <Box className="flex w-full flex-col space-y-4 p-4 pt-0">
              <Input
                {...register(`webhooks.${index}.name`)}
                id={`${field.id}-name`}
                label="Name"
                placeholder="Name"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.webhooks?.at(index)?.name}
                helperText={errors?.webhooks?.at(index)?.message}
                fullWidth
                autoComplete="off"
              />

              <Input
                {...register(`webhooks.${index}.description`)}
                id={`${field.id}-description`}
                label="Description"
                placeholder="Description"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.webhooks?.at(index)?.description}
                helperText={errors?.webhooks?.at(index)?.description?.message}
                fullWidth
                autoComplete="off"
                multiline
                inputProps={{
                  className: 'resize-y min-h-[22px]',
                }}
              />

              <Input
                {...register(`webhooks.${index}.URL`)}
                id={`${field.id}-URL`}
                label="URL"
                placeholder="URL"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.webhooks?.at(index)?.URL}
                helperText={errors?.webhooks?.at(index)?.URL?.message}
                fullWidth
                autoComplete="off"
                multiline
                inputProps={{
                  className: 'resize-y min-h-[22px]',
                }}
              />

              <ArgumentsFormSection nestedField="webhooks" nestIndex={index} />

              <Button
                variant="borderless"
                className="h-10 self-end"
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </Box>

            {index < fields.length - 1 && (
              <Divider className="h-px" sx={{ background: 'grey.200' }} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
