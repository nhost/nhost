import { EditSMSSettings } from '@/components/applications/EditSMSSettingsModal';
import { EnableSMSSignIn } from '@/components/applications/EnableSMSSignIn';
import { GeneralPermissions } from '@/components/applications/settings/providers/GeneralPermissions';
import { GravatarSettings } from '@/components/applications/settings/providers/GravatarSettings';
import { MultiFactorAuthentication } from '@/components/applications/settings/providers/MultiFactorAuthentication';
import { Provider } from '@/components/applications/users/Provider';
import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import providers from '@/data/providers.json';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useFormSaver } from '@/hooks/useFormSaver';
import { Alert } from '@/ui/Alert';
import DelayedLoading from '@/ui/DelayedLoading';
import { Divider } from '@/ui/Divider';
import { FormSaver } from '@/ui/FormSaver';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Toggle } from '@/ui/Toggle';
import Button from '@/ui/v2/Button';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';
import ChevronUpIcon from '@/ui/v2/icons/ChevronUpIcon';
import Text from '@/ui/v2/Text';
import { resolveProvider } from '@/utils/resolveProvider';
import { triggerToast } from '@/utils/toast';
import { validateDomainsInput } from '@/utils/validateDomainsInput';
import { validateEmailInputs } from '@/utils/validateEmailInputs';
import {
  refetchGetAppQuery,
  useGetAppLoginDataQuery,
  useGetAppQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import Image from 'next/image';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import validator from 'validator';

type ToggleTextElementProps = {
  desc: string;
  checked: boolean;
  onChange: () => void;
};

export function ToggleTextElement({
  desc,
  checked,
  onChange,
}: ToggleTextElementProps) {
  return (
    <div className="flex flex-row py-3 place-content-between">
      <Text
        color="greyscaleDark"
        className="self-center font-normal"
        size="normal"
      >
        {desc}
      </Text>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

type LoginInputElementProps = {
  title: string;
  desc: string;
  inputValue: string;
  inputOnChange: (v: string) => void;
};

export function LoginInputElement({
  title,
  desc,
  inputValue,
  inputOnChange,
}: LoginInputElementProps) {
  return (
    <div className="flex flex-row w-full place-content-between">
      <div className="flex flex-col">
        <Text variant="h3">{title}</Text>
        <Text color="greyscaleDark" size="normal" className="font-normal">
          {desc}
        </Text>
      </div>
      <div className="flex flex-col self-end align-bottom w-96">
        <Input
          value={inputValue}
          onChange={inputOnChange}
          placeholder="http://localhost:3000"
        />
      </div>
    </div>
  );
}

function SocialSignInProviders() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data } = useGetAppLoginDataQuery({
    variables: {
      id: currentApplication?.id,
    },
    skip: !currentApplication?.id,
  });

  return (
    <div className="flex flex-col mx-auto place-content-between font-display">
      <div className="grid grid-flow-row gap-2 mb-3">
        <Text variant="h3" component="h2">
          Social Sign-In Providers
        </Text>
        <Text>Sign in users with social sign-in providers.</Text>
      </div>
      <div className="flex flex-col border-b">
        {providers
          .filter(
            (provider) =>
              process.env.NEXT_PUBLIC_ENV !== 'production' || provider.active,
          )
          .map((provider) => (
            <Provider
              key={provider.name}
              provider={provider}
              enabled={
                data?.app![
                  `auth${resolveProvider(provider.name as string)}Enabled`
                ]
              }
            />
          ))}
      </div>
    </div>
  );
}

function ClientLoginURL({ app, setShowFormSaver, setApp }: any) {
  return (
    <div className="flex flex-col align-middle">
      <LoginInputElement
        title="Client URL"
        desc="This should be the URL of your frontend app."
        inputValue={app?.authClientUrl! || ''}
        inputOnChange={(v) => {
          setShowFormSaver(true);
          setApp({ ...app, authClientUrl: v });
        }}
      />
    </div>
  );
}

function AllowedRedirectURLs({
  submitState,
  app,
  setShowFormSaver,
  setApp,
}: any) {
  return (
    <div>
      <div className="flex flex-col mt-20 space-y-8">
        <div className="flex flex-col w-full">
          <div className="flex flex-col">
            <Text variant="h3" component="h2">
              Allowed Redirect URLs
            </Text>

            <Text>
              Comma-separated list of URLs that are allowed to be used as the
              redirectTo parameter in your sign-up and login flow.
            </Text>
          </div>

          {submitState.error &&
            submitState.fieldsWithError.includes(
              'authAccessControlAllowedRedirectUrls',
            ) && (
              <Alert severity="error" className="mt-2">
                {submitState.error.message}
              </Alert>
            )}
          <div className="self-center w-full mt-4">
            <Input
              value={app?.authAccessControlAllowedRedirectUrls || ''}
              onChange={(v) => {
                setShowFormSaver(true);
                setApp({
                  ...app,
                  authAccessControlAllowedRedirectUrls: v,
                });
              }}
              placeholder="http://localhost:3000"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-row mt-6">
        <Text className="" size="tiny" color="greyscaleDark">
          We add the success or error code as a query parameter to these URLs
          when redirecting.{' '}
          <a
            href="https://docs.nhost.io/platform/authentication/user-management#creating-users"
            target="_blank"
            rel="noreferrer"
            className="ml-0.5 cursor-pointer font-display text-xs font-medium text-blue"
          >
            Read more
          </a>
        </Text>
      </div>
    </div>
  );
}

/* TODO: we should separate sections by leveraging react-hook-form's FormProvider here */
function SettingsForm() {
  const { workspaceContext } = useWorkspaceContext();
  const [editSMSSettingsModal, setEditSMSSettingsModal] = useState(false);

  const { data, loading } = useGetAppQuery({
    variables: {
      id: workspaceContext.appId,
    },
  });
  const { showFormSaver, setShowFormSaver, submitState, setSubmitState } =
    useFormSaver();

  const [originalApp, setOriginalApp] = useState(data?.app);
  const [app, setApp] = useState(data?.app);
  const [securityAllowedEmailAndDomains, setSecurityAllowedEmailAndDomains] =
    useState(
      data?.app?.authAccessControlAllowedEmails !== '' ||
        data?.app.authAccessControlAllowedEmailDomains !== '',
    );
  const [securityBlockedEmailAndDomains, setSecurityBlockedEmailAndDomains] =
    useState(
      data?.app?.authAccessControlBlockedEmails !== '' ||
        data?.app.authAccessControlBlockedEmailDomains !== '',
    );
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  useEffect(() => {
    setOriginalApp(data?.app);

    setApp(data?.app);
    setSecurityAllowedEmailAndDomains(
      data?.app?.authAccessControlAllowedEmails !== '' ||
        data?.app.authAccessControlAllowedEmailDomains !== '',
    );
    setSecurityBlockedEmailAndDomains(
      data?.app?.authAccessControlBlockedEmails !== '' ||
        data?.app.authAccessControlBlockedEmailDomains !== '',
    );
  }, [data]);

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: [refetchGetAppQuery({ id: workspaceContext.appId })],
  });

  const handleFormSubmit = async () => {
    setSubmitState({
      loading: true,
      error: null,
      fieldsWithError: [],
    });

    const {
      authEmailSigninEmailVerifiedRequired,
      authPasswordHibpEnabled,
      authEmailPasswordlessEnabled,
      authWebAuthnEnabled,
      authClientUrl,
      authAccessControlAllowedEmails,
      authAccessControlAllowedEmailDomains,
      authAccessControlBlockedEmails,
      authAccessControlBlockedEmailDomains,
      authEmailTemplateFetchUrl,
      authAccessControlAllowedRedirectUrls,
    } = app!;

    if (
      validateEmailInputs(authAccessControlAllowedEmails) ||
      validateEmailInputs(authAccessControlBlockedEmails)
    ) {
      triggerToast('You have entered an invalid email.');
      setSubmitState({
        loading: false,
        error: new Error("Can't update app"),
        fieldsWithError: ['emails'],
      });
      setShowFormSaver(false);
      return;
    }

    if (
      authAccessControlAllowedEmailDomains ||
      authAccessControlBlockedEmailDomains
    ) {
      if (
        validateDomainsInput(authAccessControlAllowedEmailDomains) ||
        validateDomainsInput(authAccessControlBlockedEmailDomains)
      ) {
        triggerToast('You have entered an invalid domain.');
        setSubmitState({
          loading: false,
          error: new Error("Can't update app"),
          fieldsWithError: ['domain'],
        });
        setShowFormSaver(false);
        return;
      }
    }

    if (
      authEmailTemplateFetchUrl &&
      !validator.isURL(authEmailTemplateFetchUrl)
    ) {
      triggerToast('You have entered an invalid custom email template URL.');
      setSubmitState({
        loading: false,
        error: new Error("Can't update app"),
        fieldsWithError: ['authEmailTemplateFetchUrl'],
      });
      setShowFormSaver(false);
      return;
    }

    try {
      await updateApp({
        variables: {
          id: app!.id,
          app: {
            authEmailSigninEmailVerifiedRequired,
            authPasswordHibpEnabled,
            authClientUrl,
            authEmailPasswordlessEnabled,
            authWebAuthnEnabled,
            authAccessControlAllowedEmails,
            authAccessControlAllowedEmailDomains,
            authAccessControlBlockedEmails,
            authAccessControlBlockedEmailDomains,
            authAccessControlAllowedRedirectUrls,
            authEmailTemplateFetchUrl:
              !authEmailTemplateFetchUrl ||
              authEmailTemplateFetchUrl.startsWith('https://') ||
              authEmailTemplateFetchUrl.startsWith('http://')
                ? authEmailTemplateFetchUrl
                : `https://${authEmailTemplateFetchUrl}`,
          },
        },
      });
      setOriginalApp(app);
      setSubmitState({
        loading: false,
        error: null,
        fieldsWithError: [],
      });
      setShowFormSaver(false);
      triggerToast('All changes saved');
    } catch (error) {
      if (error instanceof Error) {
        triggerToast(error.message);
      }

      setSubmitState({
        loading: false,
        error,
        fieldsWithError: [],
      });
    }
  };

  const domainOrEmailErrors =
    submitState.fieldsWithError.includes('domains') ||
    submitState.fieldsWithError.includes('emails');

  if (loading) {
    return <DelayedLoading delay={500} />;
  }

  if (!app) {
    return null;
  }
  return (
    <div>
      <Modal
        showModal={editSMSSettingsModal}
        close={() => setEditSMSSettingsModal(false)}
      >
        <EditSMSSettings close={() => setEditSMSSettingsModal(false)} />
      </Modal>
      {showFormSaver && (
        <FormSaver
          show={showFormSaver}
          onCancel={() => {
            setShowFormSaver(false);
            setApp(originalApp);
          }}
          onSave={() => {
            handleFormSubmit();
          }}
          loading={submitState.loading}
        />
      )}

      <div className="grid grid-flow-row gap-5 mt-20">
        <div className="grid grid-flow-row gap-2">
          <div className="grid items-center justify-start grid-flow-col gap-2">
            <Image
              src="/assets/emailshield.svg"
              alt="An envelope with a shield in front"
              width={24}
              height={24}
            />

            <Text variant="h3" component="h2">
              Email and Password
            </Text>
          </div>

          <Text>Sign in users with Email and Password</Text>
        </div>

        <div className="flex flex-col border-t border-b divide-y-1 divide-divide">
          <ToggleTextElement
            desc="Only allow users with verified emails to sign in."
            checked={app?.authEmailSigninEmailVerifiedRequired || false}
            onChange={() => {
              setShowFormSaver(true);
              setApp({
                ...app,
                authEmailSigninEmailVerifiedRequired:
                  !app?.authEmailSigninEmailVerifiedRequired,
              });
            }}
          />

          <ToggleTextElement
            desc="Passwords must pass haveibeenpwned.com during sign-up."
            checked={app?.authPasswordHibpEnabled || false}
            onChange={() => {
              setShowFormSaver(true);
              setApp({
                ...app,
                authPasswordHibpEnabled: !app?.authPasswordHibpEnabled,
              });
            }}
          />
        </div>
      </div>

      <div className="grid grid-flow-row gap-2 mt-20">
        <div className="grid justify-between grid-flow-col">
          <div className="grid items-center justify-start grid-flow-col gap-2">
            <Image
              src="/assets/envelope.svg"
              width={24}
              height={24}
              alt="An envelope"
            />
            <Text variant="h3" component="h2">
              Magic Link
            </Text>
          </div>

          <Toggle
            checked={app?.authEmailPasswordlessEnabled || false}
            onChange={() => {
              setShowFormSaver(true);
              setApp({
                ...app,
                authEmailPasswordlessEnabled:
                  !app?.authEmailPasswordlessEnabled,
              });
            }}
          />
        </div>

        <Text>Sign in users with Magic Link.</Text>
      </div>

      <EnableSMSSignIn
        openSMSSettingsModal={() => setEditSMSSettingsModal(true)}
      />

      <div className="mt-20">
        <div className="grid grid-flow-row gap-2">
          <div className="grid justify-between grid-flow-col">
            <Text variant="h3" component="h2">
              Security Keys
            </Text>

            <Toggle
              checked={app?.authWebAuthnEnabled || false}
              onChange={() => {
                setShowFormSaver(true);
                setApp({
                  ...app,
                  authWebAuthnEnabled: !app?.authWebAuthnEnabled,
                });
              }}
            />
          </div>

          <Text>Sign in users with Security Keys using WebAuthn.</Text>
        </div>
      </div>

      <Divider spacing="low" />

      <ClientLoginURL
        setShowFormSaver={setShowFormSaver}
        app={app}
        setApp={setApp}
      />

      <AllowedRedirectURLs
        setShowFormSaver={setShowFormSaver}
        submitState={submitState}
        app={app}
        setApp={setApp}
      />

      <Divider spacing="low" />

      <div>
        <Text variant="h3" component="h2">
          Security
        </Text>

        {submitState.error && domainOrEmailErrors && (
          <Alert severity="error" className="mt-2">
            {submitState.error.message}
          </Alert>
        )}

        <div className="mt-8">
          <div className="flex flex-row place-content-between">
            <Text className="font-bold">Allowed email and domains</Text>
            <Toggle
              checked={securityAllowedEmailAndDomains}
              onChange={() => {
                if (securityAllowedEmailAndDomains) {
                  // will be toggled to false, so we'll empty all value
                  setShowFormSaver(true);
                  setApp({
                    ...app,
                    authAccessControlAllowedEmails: '',
                    authAccessControlAllowedEmailDomains: '',
                  });
                }
                setSecurityAllowedEmailAndDomains(
                  !securityAllowedEmailAndDomains,
                );
              }}
            />
          </div>
          {securityAllowedEmailAndDomains && (
            <div className="flex flex-col mt-5 space-y-2">
              <Input
                value={app?.authAccessControlAllowedEmails || ''}
                onChange={(v) => {
                  setShowFormSaver(true);
                  setApp({
                    ...app,
                    authAccessControlAllowedEmails: v,
                  });
                }}
                placeholder="These emails (separated by comma, e.g, david@ikea.com, lisa@mycompany.com)"
              />
              <Input
                value={app?.authAccessControlAllowedEmailDomains || ''}
                onChange={(v) => {
                  setShowFormSaver(true);
                  setApp({
                    ...app,
                    authAccessControlAllowedEmailDomains: v,
                  });
                }}
                placeholder="These domains (separated by comma, e.g, ikea.com, mycompany.com)"
              />
            </div>
          )}
          <div className="flex flex-row mt-6 place-content-between">
            <Text className="font-bold">Blocked email and domains</Text>
            <Toggle
              checked={securityBlockedEmailAndDomains}
              onChange={() => {
                if (securityBlockedEmailAndDomains) {
                  // will be toggled to false, so we'll empty all value
                  setShowFormSaver(true);
                  setApp({
                    ...app,
                    authAccessControlBlockedEmails: '',
                    authAccessControlBlockedEmailDomains: '',
                  });
                }
                setSecurityBlockedEmailAndDomains(
                  !securityBlockedEmailAndDomains,
                );
              }}
            />
          </div>
          {securityBlockedEmailAndDomains && (
            <div className="flex flex-col mt-5 space-y-2">
              <Input
                value={app?.authAccessControlBlockedEmails || ''}
                onChange={(v) => {
                  setShowFormSaver(true);
                  setApp({
                    ...app,
                    authAccessControlBlockedEmails: v,
                  });
                }}
                placeholder="These emails (separated by comma, e.g, david@ikea.com, lisa@mycompany.com)"
              />

              <Input
                value={app?.authAccessControlBlockedEmailDomains || ''}
                onChange={(v) => {
                  setShowFormSaver(true);
                  setApp({
                    ...app,
                    authAccessControlBlockedEmailDomains: v,
                  });
                }}
                placeholder="These domains (separated by comma, e.g, ikea.com, mycompany.com)"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-20">
        <Button
          onClick={() => setShowAdvancedFields(!showAdvancedFields)}
          variant="borderless"
          color="primary"
          className="-ml-2 grid grid-flow-col items-center gap-1.5 font-medium"
        >
          {showAdvancedFields ? (
            <>
              Hide Advanced Features
              <ChevronUpIcon className="w-4 h-4" />
            </>
          ) : (
            <>
              Show Advanced Features
              <ChevronDownIcon className="w-4 h-4" />
            </>
          )}
        </Button>

        {showAdvancedFields && (
          <div className="grid grid-flow-row gap-20 pt-10 pb-20 mx-auto bg-white">
            <GeneralPermissions />
            <MultiFactorAuthentication />
            <GravatarSettings />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignInMethodsPage() {
  return (
    <Container>
      <SocialSignInProviders />
      <SettingsForm />
    </Container>
  );
}

SignInMethodsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
