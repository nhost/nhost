import {
  useGetSmsSettingsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Text, Toggle } from '@/ui';
import DelayedLoading from '@/ui/DelayedLoading';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import { useApolloClient } from '@apollo/client';
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export function EnableSMSSignIn({ openSMSSettingsModal }: any) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetSmsSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  const [enableSMSLoginMethod, setEnableSMSLoginMethod] = useState(false);
  const client = useApolloClient();
  let toastId: string;

  useEffect(() => {
    if (!data) {
      return;
    }

    setEnableSMSLoginMethod(data.app.authSmsPasswordlessEnabled);
  }, [data]);

  if (loading) {
    return <DelayedLoading delay={500} />;
  }

  if (error) {
    throw error;
  }

  const handleDisable = async () => {
    try {
      toastId = showLoadingToast('Disabling SMS login...');
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authSmsPasswordlessEnabled: false,
          },
        },
      });
      setEnableSMSLoginMethod(false);
      await client.refetchQueries({ include: ['getSMSSettings'] });
      toast.remove(toastId);
      triggerToast('Passwordless SMS disabled.');
    } catch (updateError) {
      if (toastId) {
        toast.remove(toastId);
      }

      throw updateError;
    }
  };

  return (
    <div className="mt-20">
      <div className="mx-auto font-display">
        <div className="flex flex-col place-content-between">
          <div className="">
            <div className="flex flex-row place-content-between">
              <div className="relative flex flex-row">
                <Image
                  src="/assets/SMS.svg"
                  width={24}
                  height={24}
                  alt="Phone Number (SMS)"
                />
                <Text
                  variant="body"
                  size="large"
                  className="ml-2 font-medium"
                  color="greyscaleDark"
                >
                  Phone Number (SMS)
                </Text>
                <div>
                  <button
                    type="button"
                    className={clsx(
                      'ml-2 align-bottom text-sm- font-medium text-blue transition-opacity duration-300',
                      !enableSMSLoginMethod && 'invisible opacity-0',
                      enableSMSLoginMethod && 'opacity-100',
                    )}
                    onClick={() => openSMSSettingsModal()}
                  >
                    Edit SMS settings
                  </button>
                </div>
              </div>
              <div className="flex flex-row">
                <Toggle
                  checked={enableSMSLoginMethod}
                  onChange={async () => {
                    if (enableSMSLoginMethod) {
                      await handleDisable();
                    } else {
                      openSMSSettingsModal();
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-row self-center align-middle">
              <Text
                variant="body"
                size="normal"
                color="greyscaleDark"
                className="self-center"
              >
                Sign in users with Phone Number (SMS).
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnableSMSSignIn;
