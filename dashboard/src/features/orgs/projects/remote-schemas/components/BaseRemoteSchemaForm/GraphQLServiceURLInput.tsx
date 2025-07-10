import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useFormContext, useFormState } from 'react-hook-form';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLServiceURLInput() {
  const { register } = useFormContext<BaseRemoteSchemaFormValues>();
  const { errors } = useFormState({ name: 'definition.url' });

  return (
    <Box className="space-y-2">
      <Box className="flex flex-row items-center space-x-2">
        <Text>GraphQL Service URL</Text>
        <Tooltip title="The URL of the GraphQL service to be used as a remote schemaEnvironment variables and secrets are available using the {{VARIABLE}} tag. Environment variable templating is available for this field. Example: https://{{ENV_VAR}}/endpoint_url.">
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <Input
        {...register('definition.url')}
        id="definition.url"
        name="definition.url"
        placeholder="https://graphql-service.example.com or {{ENV_VAR}}/endpoint_url"
        className=""
        hideEmptyHelperText
        error={Boolean(errors['definition.url'])}
        autoComplete="off"
        variant="inline"
        fullWidth
        helperText={
          typeof errors['definition.url']?.message === 'string'
            ? errors['definition.url']?.message
            : ''
        }
      />
    </Box>
  );

  //     <div className="flex flex-col gap-1">
  //       <Box className="flex flex-row items-center space-x-2">
  //         <Text>Image</Text>
  //       </Box>

  //       <Box className="flex flex-col gap-1 md:flex-row md:gap-0">
  //   <Select
  //     id="type"
  //     className="col-span-5 lg:col-span-1"
  //     placeholder="HS256"
  //     hideEmptyHelperText
  //     variant="normal"
  //     defaultValue={SYMMETRIC_ALGORITHMS[0]}
  //     error={!!errors.type}
  //     helperText={errors?.type?.message}
  //     label="Hashing algorithm"
  //     value={type}
  //     onChange={(_event, value) =>
  //       setValue('type', value as string, { shouldDirty: true })
  //     }
  //   >
  //     {SYMMETRIC_ALGORITHMS.map((algorithm) => (
  //       <Option key={algorithm} value={algorithm}>
  //         {algorithm}
  //       </Option>
  //     ))}
  //   </Select>
  //         <Input
  //           value={imageTag}
  //           onChange={(e) => setImageTag(e.target.value)}
  //           id="imageTagField"
  //           className="pl-0"
  //           sx={{
  //             [`& .${inputBaseClasses.input}`]: {
  //               paddingLeft: '4px',
  //             },
  //           }}
  //           placeholder="latest"
  //           hideEmptyHelperText
  //           error={!!errors.image}
  //           fullWidth
  //           autoComplete="off"
  //         />
  //       </Box>
  //     </div>
  // );
}
