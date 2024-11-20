import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  useGetCustomClaimsQuery,
  useGetJwtSecretsQuery,
  useUpdateConfigMutation,
  type ConfigConfigUpdateInput,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CustomClaimsFormSection } from '@/features/orgs/projects/jwt/settings/components/CustomClaimsFormSection';
import { JWTSecretField } from '@/features/orgs/projects/jwt/settings/components/JWTSecretField';
import type {
  JWTSecretType,
  JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';
import {
  ASYMMETRIC_ALGORITHMS,
  SYMMETRIC_ALGORITHMS,
  validationSchema,
} from '@/features/orgs/projects/jwt/settings/types';
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
  } = jwtSecretsData?.config?.hasura?.jwtSecrets?.[0] || {};

  const {
    data: customClaimsData,
    loading: customClaimsLoading,
    error: customClaimsError,
    refetch: refetchCustomClaims,
  } = useGetCustomClaimsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const customClaims = useMemo(
    () =>
      customClaimsData?.config?.auth?.session?.accessToken?.customClaims || [],
    [customClaimsData],
  );

  let initialSignatureType: JWTSecretType = 'symmetric';

  if (
    typeof jwtType === 'string' &&
    ASYMMETRIC_ALGORITHMS.includes(
      jwtType as (typeof ASYMMETRIC_ALGORITHMS)[number],
    )
  ) {
    initialSignatureType = 'asymmetric';
  }
  if (jwk_url) {
    initialSignatureType = 'third-party';
  }

  const [signatureType, setSignatureType] =
    useState<JWTSecretType>(initialSignatureType);

  const form = useForm<JWTSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      type: jwtType || '',
      key: jwtKey || '',
      signingKey: signingKey || '',
      kid: kid || '',
      jwkUrl: jwk_url || '',
      customClaims: customClaims || [],
    },
    resolver: yupResolver(validationSchema),
    context: {
      signatureType,
    },
  });

  useEffect(() => {
    if (
      !jwtSecretsLoading &&
      !customClaimsLoading &&
      !jwtSecretsError &&
      !customClaimsError
    ) {
      form.reset({
        type: jwtType || '',
        key: jwtKey || '',
        signingKey: signingKey || '',
        kid: kid || '',
        jwkUrl: jwk_url || '',
        customClaims: customClaims || [],
      });
    }
  }, [
    jwtSecretsLoading,
    customClaimsLoading,
    jwtSecretsData,
    customClaimsData,
    jwtType,
    jwtKey,
    signingKey,
    kid,
    jwk_url,
    customClaims,
    customClaimsError,
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

  const getFormattedConfig = (
    values: JWTSettingsFormValues,
  ): ConfigConfigUpdateInput => {
    // Remove any __typename property from the values
    const sanitizedValues = removeTypename(values) as JWTSettingsFormValues;

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
    } else {
      jwtSecret = {
        jwk_url: sanitizedValues.jwkUrl,
      };
    }

    const config: ConfigConfigUpdateInput = {
      hasura: {
        jwtSecrets: [jwtSecret],
      },
      auth: {
        session: {
          accessToken: {
            customClaims: sanitizedValues.customClaims || [],
          },
        },
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
        refetchCustomClaims();

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
        loadingMessage: 'Auth version is being updated...',
        successMessage: 'Auth version has been updated successfully.',
        errorMessage: 'An error occurred while trying to update Auth version.',
      },
    );
  };

  const showCustomClaims = signatureType !== 'third-party';

  if (jwtSecretsLoading || customClaimsLoading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Auth version..."
        className="justify-center"
      />
    );
  }

  if (jwtSecretsError || customClaimsError) {
    throw new Error(
      'An error occurred while trying to fetch JWT secrets or custom claims.',
      {
        cause: {
          jwtSecretsError,
          customClaimsError,
        },
      },
    );
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
                <RadioGroupItem value="third-party" id="third-party" />
                <Label
                  htmlFor="third-party"
                  className="flex items-center gap-1"
                >
                  Third party service
                  <Tooltip
                    title={
                      <span>
                        This will use a third party service's JWK endpoint to
                        verify JWT's. Refer to{' '}
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
            <JWTSecretField secretType={signatureType} />
            {showCustomClaims && <CustomClaimsFormSection />}
          </Box>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
