import { Preview } from '@/components/applications/providers/Preview';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useFormSaver } from '@/hooks/useFormSaver';
import type { Provider } from '@/types/providers';
import { FormSaver } from '@/ui/FormSaver';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';
import { getDynamicVariables } from '@/utils/getDynamicVariables';
import { triggerToast } from '@/utils/toast';
import { useUpdateAppMutation } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';

type ProviderInfoProps = {
  provider: Provider;
  authProviderEnabled: boolean;
  setAuthProviderEnabled: (enabled: boolean) => void;
};

export function ProviderInfo({
  provider,
  authProviderEnabled,
  setAuthProviderEnabled,
}: ProviderInfoProps) {
  const router = useRouter();
  const providerId = router.query.providerId as string;
  const { showFormSaver, setShowFormSaver, submitState } = useFormSaver();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const [updateApp, { client }] = useUpdateAppMutation();

  const { authEnabled } = getDynamicVariables(providerId, {}, true);

  const handleFormSubmit = async () => {
    try {
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            [authEnabled as string]: authProviderEnabled,
          },
        },
      });

      await client.refetchQueries({
        include: ['getAppLoginData'],
      });

      setShowFormSaver(false);
      triggerToast('Settings saved');
    } catch (error) {
      // TODO: Display error to user and use a logging solution
    }
  };

  return (
    <div>
      {showFormSaver && (
        <FormSaver
          show={showFormSaver}
          onCancel={() => {
            setShowFormSaver(false);
            setAuthProviderEnabled(false);
          }}
          onSave={() => {
            handleFormSubmit();
          }}
          loading={submitState.loading}
        />
      )}
      <div className="mt-8 flex flex-row place-content-between">
        <div className=" space-y-3">
          <div className="flex flex-col">
            <Text
              variant="body"
              color="greyscaleDark"
              className=" font-bold"
              size="normal"
            >
              Let users sign in with
              <span className="ml-1 capitalize">{provider.name}</span>
            </Text>
          </div>
        </div>
        <div className="self-center">
          <Toggle
            checked={authProviderEnabled}
            onChange={() => {
              if (authProviderEnabled) {
                setShowFormSaver(true);
              }
              setAuthProviderEnabled(!authProviderEnabled);
            }}
          />
        </div>
      </div>

      {!authProviderEnabled && <Preview provider={providerId} />}
    </div>
  );
}

export default ProviderInfo;
