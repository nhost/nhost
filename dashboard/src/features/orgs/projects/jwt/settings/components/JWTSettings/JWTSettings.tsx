import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  useGetJwtSecretsQuery,
  useUpdateConfigMutation,
  type ConfigConfigUpdateInput,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
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
import { removeTypename } from '@/utils/helpers';

export default function JWTSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

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
        appId: project.id,
        config: formattedConfig,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
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

  if (jwtSecretsLoading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading JWT settings..."
        className="justify-center"
      />
    );
  }

  if (jwtSecretsError) {
    throw jwtSecretsError;
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleJWTSettingsChange}>
        <SettingsContainer
          title="JSON Web Token Settings"
          description="Select how JSON Web Tokens (JWTs) are signed and verified."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/guides/auth/jwt"
          docsTitle="JSON Web Token (JWT) Settings"
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4"
        >
          <Box className="flex flex-col gap-6">
            <RadioGroup
              className="flex flex-col gap-4 lg:flex-row"
              defaultValue="public"
              value={signatureType}
              onValueChange={handleSignatureTypeChange}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="symmetric" id="symmetric" />
                <Label htmlFor="symmetric" className="flex items-center gap-1">
                  Symmetric key
                  <Tooltip
                    title={
                      <span>
                        With symmetric keys your project uses a single for both
                        signing and verifying JWTs. Refer to{' '}
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.nhost.io/guides/auth/jwt#symmetric-keys"
                          className="underline"
                        >
                          symmetric keys
                        </a>{' '}
                        for more information.
                      </span>
                    }
                  >
                    <InfoIcon
                      aria-label="Info"
                      className="h-4 w-4"
                      color="primary"
                    />
                  </Tooltip>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="asymmetric" id="asymmetric" />
                <Label htmlFor="asymmetric" className="flex items-center gap-1">
                  Asymmetric key
                  <Tooltip
                    title={
                      <span>
                        With asymmetric keys your project uses a public and
                        private key pair for signing and verifying JWTs. Refer
                        to{' '}
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.nhost.io/guides/auth/jwt#asymmetric-keys"
                          className="underline"
                        >
                          asymmetric keys
                        </a>{' '}
                        for more information.
                      </span>
                    }
                  >
                    <InfoIcon
                      aria-label="Info"
                      className="h-4 w-4"
                      color="primary"
                    />
                  </Tooltip>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="flex items-center gap-1">
                  External signing
                  <Tooltip
                    title={
                      <span>
                        This will use a third party service&apos;s JWK endpoint
                        to verify JWT&apos;s. Alternatively you can configure
                        the public key directly. Refer to{' '}
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.nhost.io/guides/auth/jwt#external-signing"
                          className="underline"
                        >
                          external signing
                        </a>{' '}
                        for more information.
                      </span>
                    }
                  >
                    <InfoIcon
                      aria-label="Info"
                      className="h-4 w-4"
                      color="primary"
                    />
                  </Tooltip>
                </Label>
              </div>
            </RadioGroup>
            <JWTSecretField
              secretType={signatureType}
              externalSigningType={externalSigningType}
              handleExternalSigningTypeChange={handleExternalSigningTypeChange}
            />
          </Box>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
