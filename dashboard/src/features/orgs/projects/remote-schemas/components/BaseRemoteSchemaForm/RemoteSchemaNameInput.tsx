import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
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
  const { control } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <FormInput
      control={control}
      name="name"
      label="Name"
      placeholder="Remote Schema Name"
      disabled={disabled}
      autoComplete="off"
    />
  );
}
