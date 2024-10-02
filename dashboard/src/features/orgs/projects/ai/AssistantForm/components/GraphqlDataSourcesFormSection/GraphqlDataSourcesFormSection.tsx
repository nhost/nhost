import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { type AssistantFormValues } from '@/features/ai/AssistantForm/AssistantForm';
import { ArgumentsFormSection } from '@/features/ai/AssistantForm/components/ArgumentsFormSection';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function GraphqlDataSourcesFormSection() {
  const form = useFormContext<AssistantFormValues>();

  const {
    register,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: 'graphql',
  });

  return (
    <Box className="space-y-4 rounded border-1">
      <Box className="flex flex-row items-center justify-between p-4 pb-0">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            GraphQL
          </Text>
          <Tooltip title="GraphQL data sources and tools. Run against the project's GraphQL API">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() =>
            append({
              name: '',
              description: '',
              query: '',
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
                {...register(`graphql.${index}.name`)}
                id={`${field.id}-name`}
                label="Name"
                placeholder="Name"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.graphql?.at(index)?.name}
                helperText={errors?.graphql?.at(index)?.message}
                fullWidth
                autoComplete="off"
              />

              <Input
                {...register(`graphql.${index}.description`)}
                id={`${field.id}-description`}
                label="Description"
                placeholder="Description"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.graphql?.at(index)?.description}
                helperText={errors?.graphql?.at(index)?.description?.message}
                fullWidth
                autoComplete="off"
                multiline
                inputProps={{
                  className: 'resize-y min-h-[22px]',
                }}
              />

              <Input
                {...register(`graphql.${index}.query`)}
                id={`${field.id}-query`}
                label="Query"
                placeholder="Query"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.graphql?.at(index)?.query}
                helperText={errors?.graphql?.at(index)?.query?.message}
                fullWidth
                autoComplete="off"
                multiline
                inputProps={{
                  className: 'resize-y min-h-[22px]',
                }}
              />

              <ArgumentsFormSection nestedField="graphql" nestIndex={index} />

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
