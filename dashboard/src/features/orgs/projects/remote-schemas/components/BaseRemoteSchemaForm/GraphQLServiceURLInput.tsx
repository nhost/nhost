import { useFormContext } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLServiceURLInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <Box className="space-y-2">
      <Box className="flex flex-row items-center space-x-2">
        <Text>GraphQL Service URL</Text>
        <Tooltip title="The URL of the GraphQL service to be used as a remote schema. Environment variables and secrets are available using the {{VARIABLE}} tag. Example: https://{{ENV_VAR}}/endpoint_url.">
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
        error={Boolean(errors?.definition?.url)}
        autoComplete="off"
        fullWidth
        helperText={errors?.definition?.url?.message}
      />
    </Box>
  );
}
