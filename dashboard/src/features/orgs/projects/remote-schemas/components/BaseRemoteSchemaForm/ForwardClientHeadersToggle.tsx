import { useFormContext } from 'react-hook-form';
import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function ForwardClientHeadersToggle() {
  const { register } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <Box className="flex flex-row justify-between gap-2">
      <Box className="flex flex-row items-center gap-2">
        <Text>Forward all headers from client</Text>
        <Tooltip title="Toggle forwarding headers sent by the client app in the request to your remote GraphQL server">
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <ControlledSwitch
        {...register('definition.forward_client_headers')}
        className="self-center"
      />
    </Box>
  );
}
