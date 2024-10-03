import { Input } from '@/components/ui/v2/Input';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export const baseProviderValidationSchema = Yup.object({
  clientId: Yup.string()
    .label('Client ID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  clientSecret: Yup.string()
    .label('Client Secret')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  enabled: Yup.bool(),
});

export type BaseProviderSettingsFormValues = Yup.InferType<
  typeof baseProviderValidationSchema
>;

export interface BaseProviderSettingsProps {
  /**
   * The name of the provider. Used to provide unique IDs to the inputs.
   */
  providerName: string;
}

export default function BaseProviderSettings({
  providerName,
}: BaseProviderSettingsProps) {
  const { register, formState } =
    useFormContext<BaseProviderSettingsFormValues>();

  return (
    <>
      <Input
        {...register('clientId')}
        id={`${providerName}-clientId`}
        label="Client ID"
        placeholder="Enter your Client ID"
        className="col-span-1"
        fullWidth
        hideEmptyHelperText
        error={!!formState.errors?.clientId}
        helperText={formState.errors?.clientId?.message}
      />
      <Input
        {...register('clientSecret')}
        id={`${providerName}-clientSecret`}
        label="Client Secret"
        placeholder="Enter your Client Secret"
        className="col-span-1"
        fullWidth
        hideEmptyHelperText
        error={!!formState.errors?.clientSecret}
        helperText={formState.errors?.clientSecret?.message}
      />
    </>
  );
}
