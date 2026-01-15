import { useFormContext, useFormState } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function RemoteSchemaCommentInput() {
  const { register } = useFormContext<BaseRemoteSchemaFormValues>();
  const { errors } = useFormState({ name: 'comment' });

  return (
    <Box className="space-y-2">
      <Box className="flex flex-row items-center space-x-2">
        <Text>Comment</Text>
        <Tooltip title="A statement to help describe the remote schema in brief.">
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <Input
        {...register('comment')}
        id="comment"
        name="comment"
        placeholder="Comment, e.g. 'Remote schema for the Graphite API'"
        className=""
        hideEmptyHelperText
        error={Boolean(errors.comment)}
        autoComplete="off"
        fullWidth
        helperText={
          typeof errors.comment?.message === 'string'
            ? errors.comment?.message
            : ''
        }
      />
    </Box>
  );
}
