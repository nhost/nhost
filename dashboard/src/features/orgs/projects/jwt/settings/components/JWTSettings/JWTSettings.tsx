import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { RadioCard, RadioGroup } from '@/components/ui/v3/radio-group';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { JWTSecretField } from '@/features/orgs/projects/jwt/settings/components/JWTSecretField';
import type {
  ExternalSigningType,
  JWTSecretType,
  JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';
import { validationSchema } from '@/features/orgs/projects/jwt/settings/types';
import {
  ASYMMETRIC_ALGORITHMS,
  SYMMETRIC_ALGORITHMS,
} from '@/features/orgs/projects/jwt/settings/utils/constants';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type ConfigConfigUpdateInput,
  useGetJwtSecretsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { removeTypename } from '@/utils/helpers';

export default function JWTSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const track = useTrackEvent();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    data: jwtSecretsData,
    loading: jwtSecretsLoading,
    error: jwtSecretsError,
    refetch: refetchJwtSecrets,
  } = useGetJwtSecretsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    type: jwtType,
    key: jwtKey,
    signingKey,
    kid,
    jwk_url,
    ...rest
  } = jwtSecretsData?.config?.hasura?.jwtSecrets?.[0] || {};

  let initialSignatureType: JWTSecretType = 'symmetric';
  if (
    typeof jwtType === 'string' &&
    SYMMETRIC_ALGORITHMS.includes(
      jwtType as (typeof SYMMETRIC_ALGORITHMS)[number],
    )
  ) {
    initialSignatureType = 'symmetric';
  } else if (
    typeof jwtType === 'string' &&
    ASYMMETRIC_ALGORITHMS.includes(
      jwtType as (typeof ASYMMETRIC_ALGORITHMS)[number],
    ) &&
    kid
  ) {
    initialSignatureType = 'asymmetric';
  } else {
    initialSignatureType = 'external';
  }

  const initialExternalSigningType: ExternalSigningType = jwk_url
    ? 'jwk-endpoint'
    : 'public-key';

  const [signatureType, setSignatureType] =
    useState<JWTSecretType>(initialSignatureType);

  const [externalSigningType, setExternalSigningType] =
    useState<ExternalSigningType>(initialExternalSigningType);

  const form = useForm<JWTSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      type: jwtType || '',
      key: jwtKey || '',
      signingKey: signingKey || '',
      kid: kid || '',
      jwkUrl: jwk_url || '',
    },
    resolver: yupResolver(validationSchema),
    context: {
      signatureType,
      externalSigningType,
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: need to reset the form when jwtSecrets changes
  useEffect(() => {
    if (!jwtSecretsLoading && !jwtSecretsError) {
      form.reset({
        type: jwtType || '',
        key: jwtKey || '',
        signingKey: signingKey || '',
        kid: kid || '',
        jwkUrl: jwk_url || '',
      });
    }
  }, [
    jwtSecretsLoading,
    jwtSecretsData,
    jwtType,
    jwtKey,
    signingKey,
    kid,
    jwk_url,
    jwtSecretsError,
    form,
  ]);

  const { formState, reset, setValue } = form;

  const formValues = form.getValues();

  const handleSignatureTypeChange = (value: JWTSecretType) => {
    if (value === initialSignatureType) {
      reset({
        ...formValues,
        type: jwtType || '',
        key: jwtKey || '',
        signingKey: signingKey || '',
        kid: kid || '',
        jwkUrl: jwk_url || '',
      });
    } else {
      const newType =
        value === 'symmetric'
          ? SYMMETRIC_ALGORITHMS[0]
          : ASYMMETRIC_ALGORITHMS[0];
      reset({
        ...formValues,
        type: '',
        key: '',
        signingKey: '',
        kid: '',
        jwkUrl: '',
      });
      setValue('type', newType, { shouldDirty: true });
    }

    setSignatureType(value);
  };

  const handleExternalSigningTypeChange = (value: ExternalSigningType) => {
    if (value === initialExternalSigningType) {
      reset({
        ...formValues,
        type: jwtType || '',
        key: jwtKey || '',
        signingKey: signingKey || '',
        kid: kid || '',
        jwkUrl: jwk_url || '',
      });
    } else {
      reset({
        ...formValues,
        type: '',
        key: '',
        signingKey: '',
        kid: '',
        jwkUrl: '',
      });
      setValue('type', ASYMMETRIC_ALGORITHMS[0], { shouldDirty: true });
    }

    setExternalSigningType(value);
  };

  const getFormattedConfig = (
    values: JWTSettingsFormValues,
  ): ConfigConfigUpdateInput => {
    // Remove any __typename property from the values
    const sanitizedValues = removeTypename(values) as JWTSettingsFormValues;
    const sanitizedRest = removeTypename(rest);

    let jwtSecret = {};
    if (signatureType === 'symmetric') {
      jwtSecret = {
        type: sanitizedValues.type,
        key: sanitizedValues.key,
      };
    } else if (signatureType === 'asymmetric') {
      jwtSecret = {
        type: sanitizedValues.type,
        key: sanitizedValues.key,
        signingKey: sanitizedValues.signingKey,
        kid: sanitizedValues.kid,
      };
    } else if (externalSigningType === 'jwk-endpoint') {
      jwtSecret = {
        jwk_url: sanitizedValues.jwkUrl,
      };
    } else if (externalSigningType === 'public-key') {
      jwtSecret = {
        type: sanitizedValues.type,
        key: sanitizedValues.key,
      };
    }

    jwtSecret = {
      ...sanitizedRest,
      ...jwtSecret,
    };

    const config: ConfigConfigUpdateInput = {
      hasura: {
        jwtSecrets: [jwtSecret],
      },
    };

    return config;
  };

  const handleJWTSettingsChange = async (values: JWTSettingsFormValues) => {
    const formattedConfig = getFormattedConfig(values);

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: formattedConfig,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        track('JWT Configured');
        form.reset(values);
        refetchJwtSecrets();

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'JWT settings are being updated...',
        successMessage: 'JWT settings have been updated successfully.',
        errorMessage: 'An error occurred while trying to update JWT settings.',
      },
    );
  };

  if (jwtSecretsError) {
    throw jwtSecretsError;
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleJWTSettingsChange}>
        <SettingsCard>
          <SettingsCardHeader description="Select how JSON Web Tokens (JWTs) are signed and verified." />

          <SettingsCardContent className="gap-x-4 gap-y-2">
            <div className="flex flex-col gap-6">
              <RadioGroup
                className="grid gap-3 lg:grid-cols-3"
                defaultValue="public"
                value={signatureType}
                onValueChange={handleSignatureTypeChange}
              >
                <RadioCard
                  value="symmetric"
                  title="Symmetric key"
                  description="Your project uses a single key for both signing and verifying JWTs."
                  footer={
                    <TextLink
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://docs.nhost.io/products/auth/jwt#symmetric-keys"
                    >
                      Learn more
                    </TextLink>
                  }
                />
                <RadioCard
                  value="asymmetric"
                  title="Asymmetric key"
                  description="Your project uses a public and private key pair for signing and verifying JWTs."
                  footer={
                    <TextLink
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://docs.nhost.io/products/auth/jwt#asymmetric-keys"
                    >
                      Learn more
                    </TextLink>
                  }
                />
                <RadioCard
                  value="external"
                  title="External signing"
                  description="Uses a third party service's JWK endpoint to verify JWTs. You can also set the public key directly."
                  footer={
                    <TextLink
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://docs.nhost.io/products/auth/jwt#external-signing"
                    >
                      Learn more
                    </TextLink>
                  }
                />
              </RadioGroup>
              <JWTSecretField
                secretType={signatureType}
                externalSigningType={externalSigningType}
                handleExternalSigningTypeChange={
                  handleExternalSigningTypeChange
                }
              />
            </div>
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/jwt"
              title="JSON Web Token (JWT) Settings"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}
