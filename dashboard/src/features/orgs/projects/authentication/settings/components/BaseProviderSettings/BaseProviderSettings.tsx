/** biome-ignore-all lint/suspicious/noThenProperty: yup thing */

import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';

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

export default function BaseProviderSettings() {
  const { control } = useFormContext<BaseProviderSettingsFormValues>();

  return (
    <>
      <FormInput
        control={control}
        name="clientId"
        label="Client ID"
        placeholder="Enter your Client ID"
        containerClassName="col-span-1"
      />
      <FormInput
        control={control}
        name="clientSecret"
        label="Client Secret"
        placeholder="Enter your Client Secret"
        containerClassName="col-span-1"
      />
    </>
  );
}
