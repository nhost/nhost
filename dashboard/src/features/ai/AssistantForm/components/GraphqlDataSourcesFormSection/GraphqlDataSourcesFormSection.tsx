import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
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
    name: 'dataSources.graphql',
  });

  return (
    <Box className="space-y-4 rounded border-1">
      <Box className="flex flex-row items-center justify-between p-4 pb-0">
        <Text variant="h4" className="font-semibold">
          GraphQL
        </Text>
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
          <PlusIcon className="w-5 h-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex flex-col space-y-4">
            <Box className="flex flex-col w-full p-4 pt-0 space-y-4">
              <Input
                {...register(`dataSources.graphql.${index}.name`)}
                id={`${field.id}-name`}
                label="Name"
                placeholder="Name"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.dataSources?.graphql?.at(index)?.name}
                helperText={errors?.dataSources?.graphql?.at(index)?.message}
                fullWidth
                autoComplete="off"
              />

              <Input
                {...register(`dataSources.graphql.${index}.description`)}
                id={`${field.id}-description`}
                label="Description"
                placeholder="Description"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.dataSources?.graphql?.at(index)?.description}
                helperText={
                  errors?.dataSources?.graphql?.at(index)?.description?.message
                }
                fullWidth
                autoComplete="off"
              />

              <Input
                {...register(`dataSources.graphql.${index}.query`)}
                id={`${field.id}-query`}
                label="Query"
                placeholder="Query"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.dataSources?.graphql?.at(index)?.query}
                helperText={
                  errors?.dataSources?.graphql?.at(index)?.query?.message
                }
                fullWidth
                autoComplete="off"
                multiline
                rows={4}
              />

              <ArgumentsFormSection nestedField="graphql" nestIndex={index} />

              <Button
                variant="borderless"
                className="self-end h-10"
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="w-4 h-4" />
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
