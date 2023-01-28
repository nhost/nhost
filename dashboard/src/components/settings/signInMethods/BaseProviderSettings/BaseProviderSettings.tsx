import Input from '@/ui/v2/Input';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export const baseProviderValidationSchema = Yup.object({
  clientId: Yup.string().label('Client ID').nullable().required(),
  clientSecret: Yup.string().label('Client Secret').nullable().required(),
  enabled: Yup.bool(),
});

export type BaseProviderSettingsFormValues = Yup.InferType<
  typeof baseProviderValidationSchema
>;

/**
 * Third-party auth providers e.g. Google, GitHub.
 *
 * @remarks
 *
 * These providers follow the same API structure in our database and in our GraphQL API:
 * In the case of adding a new provider to this list it should contain the configuration in the example below.
 *
 * ```
 * auth<Provider>Enabled
 * auth<Provider>ClientId
 * auth<Provider>ClientSecret
 * ```
 *
 * @example
 *
 * ```
 * authGithubEnabled
 * authGithubClientId
 * authGithubClientSecret
 * ```
 *
 * @remarks If the provider has a different configuration (more or less fields) it should be added as its own component
 * @see {@link 'src\components\settings\sign-in-methods\ProviderTwitterSettings\ProviderTwitterSettings.tsx'}
 *
 */
export default function BaseProviderSettings() {
  const { register, formState } =
    useFormContext<BaseProviderSettingsFormValues>();

  return (
    <>
      <Input
        {...register('clientId')}
        id="clientId"
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
        id="clientSecret"
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
