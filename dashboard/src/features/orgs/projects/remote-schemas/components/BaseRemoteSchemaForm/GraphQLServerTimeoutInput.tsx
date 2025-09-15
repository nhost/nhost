import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS } from '@/features/orgs/projects/remote-schemas/utils/constants';
import { useFormContext } from 'react-hook-form';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLServerTimeoutInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <Box className="space-y-2">
      <Box className="flex flex-row items-center space-x-2">
        <Text>GraphQL Server Timeout</Text>
        <Tooltip title="Configure timeout for your remote GraphQL server.">
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <Input
        {...register('definition.timeout_seconds')}
        id="definition.timeout_seconds"
        name="definition.timeout_seconds"
        placeholder={DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS.toString()}
        className=""
        hideEmptyHelperText
        error={Boolean(errors?.definition?.timeout_seconds)}
        autoComplete="off"
        fullWidth
        helperText={errors?.definition?.timeout_seconds?.message}
        endAdornment={
          <Text sx={{ color: 'grey.500' }} className="pr-2">
            seconds
          </Text>
        }
      />
    </Box>
  );
}
