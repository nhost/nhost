import {
  ProviderSetting,
  ProviderSettingsSave,
} from '@/components/applications/settings/providers';
import type { GetAppFragment } from '@/generated/graphql';
import { useUpdateAppMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useFormSaver } from '@/hooks/useFormSaver';
import type { Provider } from '@/types/providers';
import { Alert } from '@/ui/Alert';
import { FormSaver } from '@/ui/FormSaver';
import Button from '@/ui/v2/Button';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';
import ChevronUpIcon from '@/ui/v2/icons/ChevronUpIcon';
import { capitalize, generateRemoteAppUrl } from '@/utils/helpers';
import { resolveProvider } from '@/utils/resolveProvider';
import { triggerToast } from '@/utils/toast';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import AppleProviderSettingsForm from './AppleProviderSettingsForm';
import GeneralProviderSettingsForm from './GeneralProviderSettingsForm';
import WorkOsProviderSettingsForm from './WorkOsProviderSettingsForm';

export interface ProviderSettingsProps {
  provider: Provider;
  app: GetAppFragment;
  authProviderEnabled: boolean;
}

// TODO 1: Simplify this component, improve the reusability by redesigning the
// way the component renders the content, because it's hard to create a provider
// specific layout with the current implementation.

// TODO 2: Change the form to use react-hook-form, so that we can avoid passing
// too much props around these components (e.g: passing xy and handleXyChange to
// children would not be necessary at all).

// TODO 3: This is an accessibility improvement, but labels should be connected
// to the inputs.
export function ProviderSettings({
  provider,
  app,
  authProviderEnabled,
}: ProviderSettingsProps) {
  const router = useRouter();
  const providerId = router.query.providerId as string;
  const [hideSettings, setHideSettings] = useState(false);
  const [hasSettings, setHasSettings] = useState(false);
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const {
    authClientId,
    authClientSecret,
    authTeamId,
    authKeyId,
    authDefaultDomain,
    authDefaultOrganization,
    authDefaultConnection,
    // TODO: This function should be extracted from this component and also it
    // should be checked why values are used from it's return value **inside**
    // the function body.
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
  } = getProviderSpecificVariables(providerId);

  const [authProviderClientSecret, setAuthProviderClientSecret] = useState(
    app[authClientSecret] || '',
  );

  const [authProviderClientId, setAuthProviderClientId] = useState(
    app[authClientId] || '',
  );

  const [authProviderTeamId, setAuthProviderTeamId] = useState(
    app[authTeamId] || '',
  );

  const [authProviderKeyId, setAuthProviderKeyId] = useState(
    app[authKeyId] || '',
  );

  const [authProviderDefaultDomain, setAuthProviderDefaultDomain] = useState(
    app[authDefaultDomain] || '',
  );
  const [authProviderDefaultOrganization, setAuthProviderDefaultOrganization] =
    useState(app[authDefaultOrganization] || '');
  const [authProviderDefaultConnection, setAuthProviderDefaultConnection] =
    useState(app[authDefaultConnection] || '');

  const [callError, setCallError] = useState({ error: false, message: '' });

  const [updateApp, { client, loading }] = useUpdateAppMutation();
  const { showFormSaver, setShowFormSaver, submitState } = useFormSaver();

  function getProviderSpecificVariables(
    targetProvider: string,
    { prefill = true } = {},
  ) {
    if (targetProvider === 'twitter') {
      if (!prefill) {
        return {
          authTwitterEnabled: authProviderEnabled,
          authTwitterConsumerKey: authProviderClientId,
          authTwitterConsumerSecret: authProviderClientSecret,
        };
      }

      return {
        authEnabled: 'authTwitterEnabled',
        authClientId: 'authTwitterConsumerKey',
        authClientSecret: 'authTwitterConsumerSecret',
      };
    }

    if (targetProvider === 'apple') {
      if (!prefill) {
        return {
          authAppleEnabled: authProviderEnabled,
          authAppleClientId: authProviderClientId,
          authAppleKeyId: authProviderKeyId,
          authAppleTeamId: authProviderTeamId,
          authApplePrivateKey: authProviderClientSecret.replace(/\n/gi, '\\n'),
        };
      }

      return {
        authEnabled: 'authAppleEnabled',
        authClientId: 'authAppleClientId',
        authClientSecret: 'authApplePrivateKey',
        authTeamId: 'authAppleTeamId',
        authKeyId: 'authAppleKeyId',
      };
    }

    if (targetProvider === 'workos') {
      if (!prefill) {
        return {
          authWorkOsEnabled: authProviderEnabled,
          authWorkOsClientId: authProviderClientId,
          authWorkOsClientSecret: authProviderClientSecret,
          authWorkOsDefaultDomain: authProviderDefaultDomain,
          authWorkOsDefaultOrganization: authProviderDefaultOrganization,
          authWorkOsDefaultConnection: authProviderDefaultConnection,
        };
      }

      return {
        authEnabled: 'authWorkOsEnabled',
        authClientId: 'authWorkOsClientId',
        authClientSecret: 'authWorkOsClientSecret',
        authDefaultDomain: 'authWorkOsDefaultDomain',
        authDefaultOrganization: 'authWorkOsDefaultOrganization',
        authDefaultConnection: 'authWorkOsDefaultConnection',
      };
    }

    const authEnabled = `auth${resolveProvider(providerId)}Enabled`;
    const clientId = `auth${resolveProvider(providerId)}ClientId`;
    const clientSecret = `auth${resolveProvider(providerId)}ClientSecret`;

    if (!prefill) {
      return {
        [authEnabled]: authProviderEnabled,
        [clientId]: authProviderClientId,
        [clientSecret]: authProviderClientSecret,
      };
    }

    return {
      authEnabled,
      authClientId: clientId,
      authClientSecret: clientSecret,
    };
  }

  useEffect(() => {
    // Gets the particular providerId GQL field.
    const { authEnabled } = getProviderSpecificVariables(providerId);
    // Checks if the providerId field is enabled on the app that we get from origin.
    if (app[authEnabled]) {
      setHasSettings(true);
      setHideSettings(true);
    }
  }, [hasSettings, setHasSettings, app]);

  useEffect(() => {
    const {
      authClientId: clientId,
      authTeamId: teamId,
      authKeyId: keyId,
      authClientSecret: clientSecret,
    } = getProviderSpecificVariables(providerId);

    // This side effect checks if the clientId or secret doesn't equal the app's clientId or secret and shows the form saver, which can be used to save the new changes.
    if (
      hasSettings &&
      (app[clientSecret] !== authProviderClientSecret ||
        app[clientId] !== authProviderClientId ||
        app[teamId] !== authProviderTeamId ||
        app[keyId] !== authProviderKeyId)
    ) {
      setShowFormSaver(true);
    }
  }, [
    hasSettings,
    authProviderClientSecret,
    authProviderClientId,
    authProviderTeamId,
    authProviderKeyId,
    authClientSecret,
    authClientId,
  ]);

  const handleSettingsToggle = (e) => {
    e.preventDefault();
    setHideSettings(!hideSettings);
  };

  const handleSubmit = async (e?: React.SyntheticEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
    }
    try {
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            ...getProviderSpecificVariables(providerId, { prefill: false }),
          },
        },
      });
    } catch (error) {
      setCallError({ error: true, message: error.message });
      return;
    }
    await client.refetchQueries({
      include: ['getAppLoginData'],
    });
    setShowFormSaver(false);
    triggerToast('Settings saved');
  };

  const handleClientIdChange = (value: string) => {
    setCallError({ error: false, message: '' });
    setAuthProviderClientId(value);
  };

  const handleTeamIdChange = (value: string) => {
    setCallError({ error: false, message: '' });
    setAuthProviderTeamId(value);
  };

  const handleKeyIdChange = (value: string) => {
    setCallError({ error: false, message: '' });
    setAuthProviderKeyId(value);
  };

  const handleClientSecretChange = (value: string) => {
    setCallError({ error: false, message: '' });
    setAuthProviderClientSecret(value);
  };

  return (
    <>
      {showFormSaver && (
        <FormSaver
          show={showFormSaver}
          onCancel={() => {
            setShowFormSaver(false);
          }}
          onSave={() => {
            handleSubmit();
          }}
          loading={submitState.loading}
        />
      )}

      <form onSubmit={handleSubmit}>
        {authProviderEnabled && (
          <div className="mt-8 space-y-3 divide-y-1 divide-divide border-t border-b pb-2">
            {!hideSettings && (
              <>
                {providerId === 'apple' && (
                  <AppleProviderSettingsForm
                    authProviderClientId={authProviderClientId}
                    authProviderTeamId={authProviderTeamId}
                    authProviderKeyId={authProviderKeyId}
                    authProviderClientSecret={authProviderClientSecret}
                    handleClientIdChange={handleClientIdChange}
                    handleTeamIdChange={handleTeamIdChange}
                    handleKeyIdChange={handleKeyIdChange}
                    handleClientSecretChange={handleClientSecretChange}
                  />
                )}
                {providerId !== 'apple' && (
                  <GeneralProviderSettingsForm
                    provider={provider}
                    authProviderClientId={authProviderClientId}
                    authProviderClientSecret={authProviderClientSecret}
                    handleClientIdChange={handleClientIdChange}
                    handleClientSecretChange={handleClientSecretChange}
                  />
                )}
                {providerId === 'workos' && (
                  <WorkOsProviderSettingsForm
                    defaultDomain={authProviderDefaultDomain}
                    defaultOrganization={authProviderDefaultOrganization}
                    defaultConnection={authProviderDefaultConnection}
                    handleDefaultDomainChange={setAuthProviderDefaultDomain}
                    handleDefaultOrganizationChange={
                      setAuthProviderDefaultOrganization
                    }
                    handleDefaultConnectionChange={
                      setAuthProviderDefaultConnection
                    }
                  />
                )}
              </>
            )}

            <ProviderSetting
              title={hideSettings ? 'Login button URL' : 'OAuth Callback URL'}
              desc={
                hideSettings
                  ? `Use this in your frontend`
                  : `Paste into ${capitalize(providerId)}`
              }
              inputPlaceholder=""
              input={false}
              showCopy
              link={
                hideSettings
                  ? `${generateRemoteAppUrl(
                      app.subdomain,
                    )}/v1/auth/signin/provider/${providerId.toLowerCase()}`
                  : `${generateRemoteAppUrl(
                      app.subdomain,
                    )}/v1/auth/signin/provider/${providerId.toLowerCase()}/callback`
              }
            />
          </div>
        )}

        {callError.error && (
          <Alert severity="error">
            {callError.message ||
              'Error trying to update login provider settings.'}
          </Alert>
        )}

        {authProviderEnabled && hasSettings && (
          <div className="mt-4 px-2">
            <Button
              variant="borderless"
              onClick={handleSettingsToggle}
              className="grid grid-flow-col gap-1.5 text-xs"
            >
              {hideSettings ? (
                <>
                  View Settings
                  <ChevronDownIcon className="h-4 w-4" />
                </>
              ) : (
                <>
                  Hide Settings
                  <ChevronUpIcon className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {authProviderEnabled && !hasSettings && (
          <ProviderSettingsSave provider={provider} loading={loading} />
        )}
      </form>
    </>
  );
}
