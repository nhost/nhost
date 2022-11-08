import { PermissionSetting } from '@/components/applications/users/PermissionSetting';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useSubmitState } from '@/hooks/useSubmitState';
import { Toggle } from '@/ui';
import { Alert } from '@/ui/Alert';
import DelayedLoading from '@/ui/DelayedLoading';
import { Text } from '@/ui/Text';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import {
  useGetGravatarSettingsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useApolloClient } from '@apollo/client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export function GravatarSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();
  const [currentDefaultGravatar, setCurrentDefaultGravatar] = useState({
    id: 'blank',
    name: 'blank',
    disabled: false,
    slug: 'blank',
  });
  const [currentGravatarRating, setCurrentGravatarRating] = useState({
    id: 'g',
    name: 'g',
    disabled: false,
    slug: 'g',
  });

  const { submitState, setSubmitState } = useSubmitState();

  const { loading, data, error } = useGetGravatarSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });
  let toastId: string;

  useEffect(() => {
    if (!data) {
      return;
    }

    setCurrentDefaultGravatar((previousDefaultGravatar) => ({
      ...previousDefaultGravatar,
      name: data.app.authGravatarDefault,
      id: data.app.authGravatarDefault,
      slug: data.app.authGravatarDefault,
    }));

    setCurrentGravatarRating((previousGravatarRating) => ({
      ...previousGravatarRating,
      name: data.app.authGravatarRating,
      id: data.app.authGravatarRating,
      slug: data.app.authGravatarRating,
    }));
  }, [data, setCurrentDefaultGravatar, setCurrentGravatarRating]);

  if (loading) {
    return <DelayedLoading delay={500} />;
  }

  if (error) {
    throw error;
  }

  return (
    <div className="mx-auto w-full font-display">
      <div className="flex flex-row place-content-between">
        <div className="flex flex-col">
          <Text
            variant="body"
            size="large"
            className="font-medium"
            color="greyscaleDark"
          >
            Gravatar Settings
          </Text>
          <div>
            <Text
              variant="body"
              size="normal"
              color="greyscaleDark"
              className="mt-1"
            >
              Enable Gravatars as avatar URL for users.
            </Text>
          </div>
        </div>
        <div className="mr-2 flex flex-row">
          <Toggle
            checked={data.app.authGravatarEnabled}
            onChange={async () => {
              try {
                toastId = showLoadingToast('Saving changes...');
                await updateApp({
                  variables: {
                    id: currentApplication.id,
                    app: {
                      authGravatarEnabled: !data.app.authGravatarEnabled,
                    },
                  },
                });
                await client.refetchQueries({
                  include: ['getGravatarSettings'],
                });
                toast.remove(toastId);
                triggerToast(
                  `Gravatars ${
                    data.app.authGravatarEnabled ? `Disabled` : `Enabled`
                  } for ${currentApplication.name}`,
                );
              } catch (updateError) {
                if (updateError instanceof Error) {
                  triggerToast(updateError.message);
                }

                if (toastId) {
                  toast.remove(toastId);
                }

                setSubmitState({
                  loading: false,
                  error: updateError,
                  fieldsWithError: ['authGravatarEnabled'],
                });
              }
            }}
          />
        </div>
      </div>

      {submitState.error && (
        <Alert severity="error" className="mt-4">
          {submitState.error.message}
        </Alert>
      )}

      {data.app.authGravatarEnabled && (
        <div className="mt-6 mb-12 flex flex-col divide-y-1 divide-divide border-t border-b">
          <PermissionSetting
            text="AUTH_GRAVATAR_DEFAULT"
            options={[
              {
                id: '404',
                name: '404',
              },
              {
                id: 'mp',
                name: 'mp',
              },
              {
                id: 'identicon',
                name: 'identicon',
              },
              {
                id: 'monsterid',
                name: 'monsterid',
              },
              {
                id: 'waatar',
                name: 'waatar',
              },
              {
                id: 'retro',
                name: 'retro',
              },
              {
                id: 'robohash',
                name: 'robohash',
              },
              {
                id: 'blank',
                name: 'blank',
              },
            ]}
            value={currentDefaultGravatar}
            onChange={async (v: { id: string }) => {
              try {
                await updateApp({
                  variables: {
                    id: currentApplication.id,
                    app: {
                      authGravatarDefault: v.id,
                    },
                  },
                });
                client.refetchQueries({ include: ['getGravatarSettings'] });
                triggerToast(
                  `Changed default gravatar for ${currentApplication.name}`,
                );
              } catch (updateError) {
                if (updateError instanceof Error) {
                  triggerToast(updateError.message);
                }

                setSubmitState({
                  loading: false,
                  error: updateError,
                  fieldsWithError: ['authGravatarDefault'],
                });
              }
            }}
          />
          <PermissionSetting
            text="AUTH_GRAVATAR_RATING"
            options={[
              {
                id: 'g',
                name: 'g',
              },
              {
                id: 'pg',
                name: 'pg',
              },
              {
                id: 'r',
                name: 'r',
              },
              {
                id: 'x',
                name: 'x',
              },
            ]}
            value={currentGravatarRating}
            onChange={async (v: { id: string }) => {
              try {
                await updateApp({
                  variables: {
                    id: currentApplication.id,
                    app: {
                      authGravatarRating: v.id,
                    },
                  },
                });
                client.refetchQueries({ include: ['getGravatarSettings'] });
                triggerToast(
                  `Changed Gravatar rating for ${currentApplication.name}`,
                );
              } catch (updateError) {
                if (updateError instanceof Error) {
                  triggerToast(updateError.message);
                }

                setSubmitState({
                  loading: false,
                  error: updateError,
                  fieldsWithError: ['authGravatarRating'],
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default GravatarSettings;
