import { yupResolver } from '@hookform/resolvers/yup';
import { InfoIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
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
import { removeTypename } from '@/utils/helpers';

function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

export default function JWTSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
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
          <SettingsCardHeader
            title="JSON Web Token Settings"
            description="Select how JSON Web Tokens (JWTs) are signed and verified."
          />

          <SettingsCardContent className="gap-x-4 gap-y-2">
            <div className="flex flex-col gap-6">
              <RadioGroup
                className="flex flex-col gap-4 lg:flex-row"
                defaultValue="public"
                value={signatureType}
                onValueChange={handleSignatureTypeChange}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="symmetric" id="symmetric" />
                  <Label
                    htmlFor="symmetric"
                    className="flex items-center gap-1"
                  >
                    Symmetric key
                    <InfoTooltip>
                      <span>
                        With symmetric keys your project uses a single key for
                        both signing and verifying JWTs. Refer to{' '}
                        <TextLink
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.nhost.io/products/auth/jwt#symmetric-keys"
                          className="underline"
                        >
                          symmetric keys
                        </TextLink>{' '}
                        for more information.
                      </span>
                    </InfoTooltip>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="asymmetric" id="asymmetric" />
                  <Label
                    htmlFor="asymmetric"
                    className="flex items-center gap-1"
                  >
                    Asymmetric key
                    <InfoTooltip>
                      <span>
                        With asymmetric keys your project uses a public and
                        private key pair for signing and verifying JWTs. Refer
                        to{' '}
                        <TextLink
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.nhost.io/products/auth/jwt#asymmetric-keys"
                          className="underline"
                        >
                          asymmetric keys
                        </TextLink>{' '}
                        for more information.
                      </span>
                    </InfoTooltip>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="external" id="external" />
                  <Label htmlFor="external" className="flex items-center gap-1">
                    External signing
                    <InfoTooltip>
                      <span>
                        This will use a third party service&apos;s JWK endpoint
                        to verify JWT&apos;s. Alternatively you can configure
                        the public key directly. Refer to{' '}
                        <TextLink
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.nhost.io/products/auth/jwt#external-signing"
                          className="underline"
                        >
                          external signing
                        </TextLink>{' '}
                        for more information.
                      </span>
                    </InfoTooltip>
                  </Label>
                </div>
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
