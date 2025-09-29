import { useFormContext } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export interface RemoteSchemaNameInputProps {
  /**
   * Whether the input should be disabled.
   */
  disabled?: boolean;
}

export default function RemoteSchemaNameInput({
  disabled,
}: RemoteSchemaNameInputProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <Box className="space-y-2">
      <Box className="flex flex-row items-center space-x-2">
        <Text>Name</Text>
      </Box>
      <Input
        {...register('name')}
        id="name"
        name="name"
        placeholder="Remote Schema Name"
        disabled={disabled}
        className=""
        hideEmptyHelperText
        error={Boolean(errors?.name)}
        autoComplete="off"
        fullWidth
        helperText={errors?.name?.message}
      />
    </Box>
  );
}
