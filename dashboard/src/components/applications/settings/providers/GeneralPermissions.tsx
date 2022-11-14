import { PermissionSetting } from '@/components/applications/users/PermissionSetting';
import { SettingsSection } from '@/components/applications/users/SettingsSection';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useSubmitState } from '@/hooks/useSubmitState';
import { Alert } from '@/ui/Alert';
import DelayedLoading from '@/ui/DelayedLoading';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import {
  useGetAuthSettingsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useApolloClient } from '@apollo/client';
import toast from 'react-hot-toast';

export function GeneralPermissions() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();
  const { submitState, setSubmitState } = useSubmitState();
  let toastId: string;

  const { loading, data, error } = useGetAuthSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  if (loading) {
    return <DelayedLoading delay={500} />;
  }

  if (error) {
    throw error;
  }

  return (
    <div className="mx-auto w-full bg-white ">
      <SettingsSection
        title="General Permissions"
        desc="These settings affect all users in your project."
      >
        {submitState.error && (
          <Alert severity="error">{submitState.error.message}</Alert>
        )}
        <div className="divide-y-1 border-t border-b">
          <PermissionSetting
            text="Disable New Users"
            desc="If set, newly registered users are disabled and won't be able to sign in."
            toggle
            checked={data.app.authDisableNewUsers}
            onChange={async () => {
              try {
                toastId = showLoadingToast('Saving changes...');
                await updateApp({
                  variables: {
                    id: currentApplication.id,
                    app: {
                      authDisableNewUsers: !data.app.authDisableNewUsers,
                    },
                  },
                });
                await client.refetchQueries({ include: ['getAuthSettings'] });
                toast.remove(toastId);
                triggerToast(
                  `Disable new users ${
                    data.app.authDisableNewUsers ? `Disabled` : `Enabled`
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
                  fieldsWithError: ['authDisableNewUsers'],
                });
              }
            }}
          />
          <PermissionSetting
            text="Allow Anonymous Users"
            desc="Enables users to register as an anonymous user."
            toggle
            checked={data.app.authAnonymousUsersEnabled}
            onChange={async () => {
              setSubmitState({
                loading: true,
                error: null,
                fieldsWithError: [],
              });
              try {
                toastId = showLoadingToast('Saving changes...');
                await updateApp({
                  variables: {
                    id: currentApplication.id,
                    app: {
                      authAnonymousUsersEnabled:
                        !data.app.authAnonymousUsersEnabled,
                    },
                  },
                });
                await client.refetchQueries({ include: ['getAuthSettings'] });
                toast.remove(toastId);
                triggerToast(
                  `Anonymous users registration ${
                    data.app.authAnonymousUsersEnabled ? `disabled` : `enabled`
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
                  fieldsWithError: ['authAnonymousUsersEnabled'],
                });
              }
            }}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

export default GeneralPermissions;
