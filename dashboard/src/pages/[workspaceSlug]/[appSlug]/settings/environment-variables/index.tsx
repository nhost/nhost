import EditEnvVarModal from '@/components/applications/EditEnvVarModal';
import { JWTSecretModal } from '@/components/applications/JWTSecretModal';
import AddEnvVarModal from '@/components/applications/variables/AddEnvVarModal';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Eye from '@/components/icons/Eye';
import EyeOff from '@/components/icons/EyeOff';
import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import IconButton from '@/ui/v2/IconButton';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { generateRemoteAppUrl } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import type { EnvironmentVariableFragment } from '@/utils/__generated__/graphql';
import {
  refetchGetEnvironmentVariablesWhereQuery,
  useGetAppInjectedVariablesQuery,
  useGetEnvironmentVariablesWhereQuery,
  useInsertEnvironmentVariablesMutation,
} from '@/utils/__generated__/graphql';
import { format } from 'date-fns';
import type { ReactElement } from 'react';
import React, { useState } from 'react';

export type SystemVariableModalState = 'SHOW' | 'EDIT' | 'CLOSED';

function EnvHeader() {
  return (
    <div className="grid grid-flow-row gap-1">
      <Text variant="h2" component="h1">
        Environment Variables
      </Text>

      <Link
        href="https://docs.nhost.io/platform/environment-variables"
        target="_blank"
        rel="noreferrer"
        underline="hover"
        className="justify-self-start font-medium"
      >
        Documentation
      </Link>
    </div>
  );
}

function AppVariablesHeader() {
  return (
    <div>
      <div className="flex flex-row place-content-between px-2 py-2">
        <Text
          variant="subtitle2"
          className="w-drop font-bold !text-greyscaleDark"
        >
          Variable name
        </Text>
        <Text
          variant="subtitle2"
          className="w-drop font-bold !text-greyscaleDark"
        >
          Updated
        </Text>
        <Text
          variant="subtitle2"
          className="w-drop font-bold !text-greyscaleDark"
        >
          Overrides
        </Text>
      </div>
    </div>
  );
}

function AddNewAppVariable() {
  const { workspaceContext } = useWorkspaceContext();
  const { appId } = workspaceContext;
  const [showModal, setShowModal] = useState(false);

  const [insertEnvVar, { loading }] = useInsertEnvironmentVariablesMutation({
    refetchQueries: [
      refetchGetEnvironmentVariablesWhereQuery({
        where: {
          appId: {
            _eq: appId,
          },
        },
      }),
    ],
  });

  return (
    <div className="flex flex-row py-1.5">
      <Modal showModal={showModal} close={() => setShowModal(!showModal)}>
        <AddEnvVarModal
          onSubmit={async ({ name, prodValue, devValue }) => {
            try {
              await insertEnvVar({
                variables: {
                  environmentVariables: [
                    {
                      appId,
                      name,
                      prodValue,
                      devValue,
                    },
                  ],
                },
              });
              triggerToast(
                `New environment variable ${name} added successfully.`,
              );
            } catch (error) {
              if (error.message.includes('Uniqueness violation.')) {
                triggerToast('Environment variable already exists.');
                return;
              }

              triggerToast('Error adding environment variable.');
              return;
            }

            setShowModal(false);
          }}
          close={() => setShowModal(false)}
        />
      </Modal>

      <Button
        variant="borderless"
        onClick={() => setShowModal(true)}
        loading={loading}
        size="small"
      >
        New Variable
      </Button>
    </div>
  );
}

type AppVariableProps = {
  envVar: EnvironmentVariableFragment;
};

function AppVariable({ envVar }: AppVariableProps) {
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <>
      {showEditModal && (
        <EditEnvVarModal
          show={showEditModal}
          close={() => {
            setShowEditModal(false);
          }}
          envVar={envVar}
        />
      )}
      <div
        className="flex cursor-pointer flex-row place-content-between px-2 py-2"
        role="button"
        onClick={() => setShowEditModal(true)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          setShowEditModal(true);
        }}
      >
        <Text className="w-drop">{envVar.name}</Text>
        <Text className="w-drop">
          {format(new Date(envVar.updatedAt), 'dd MMM yyyy')}
        </Text>
        <Text className="w-drop">-</Text>
      </div>
    </>
  );
}

function SectionContainer({ title, children }: any) {
  return (
    <div className="mt-8 w-full space-y-6">
      <Text variant="h3">{title}</Text>
      <div className="divide divide-y-1 border-t-1 border-b-1">{children}</div>
    </div>
  );
}

function AppEnvironmentVariables() {
  const { workspaceContext } = useWorkspaceContext();
  const { appId } = workspaceContext;

  const { data, error } = useGetEnvironmentVariablesWhereQuery({
    variables: {
      where: {
        appId: {
          _eq: appId,
        },
      },
    },
    fetchPolicy: 'cache-first',
    skip: !appId,
  });

  if (error) {
    throw error;
  }

  if (!data || !data.environmentVariables) {
    return (
      <SectionContainer title="Project Environment Variables">
        <AppVariablesHeader />

        <AddNewAppVariable />
      </SectionContainer>
    );
  }

  const { environmentVariables } = data;

  return (
    <SectionContainer title="Project Environment Variables">
      <AppVariablesHeader />

      {environmentVariables.map((envVar) => (
        <AppVariable key={envVar.id} envVar={envVar} />
      ))}
      <AddNewAppVariable />
    </SectionContainer>
  );
}

function SensitiveValue({ value }: { value: string | any }) {
  const [eye, setEye] = React.useState(false);

  if (!value) {
    return null;
  }

  return (
    <div className="grid w-full grid-flow-col items-center gap-2">
      <button
        type="button"
        onClick={() => setEye(!eye)}
        tabIndex={-1}
        aria-label={eye ? 'Hide sensitive value' : 'Reveal sensitive value'}
      >
        <Text>{eye ? value : Array(value.length).fill('•').join('')}</Text>
      </button>

      <IconButton
        className="p-1"
        onClick={() => setEye(!eye)}
        aria-label={eye ? 'Hide sensitive value' : 'Reveal sensitive value'}
        variant="borderless"
        color="secondary"
      >
        {eye ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </IconButton>
    </div>
  );
}

interface SystemVariableProps {
  envVar: string;
  value: string;
  sensitive?: boolean;
  modal?: boolean;
  systemVariableModal?: React.ElementType;
}

function SystemVariable({
  envVar,
  value,
  modal = false,
  sensitive = false,
  systemVariableModal: SystemVariableModal,
}: SystemVariableProps) {
  const [modalState, setModalState] =
    useState<SystemVariableModalState>('CLOSED');

  return (
    <>
      {modal && (
        <Modal
          showModal={modalState === 'SHOW' || modalState === 'EDIT'}
          close={() => setModalState('CLOSED')}
        >
          <SystemVariableModal
            close={() => setModalState('CLOSED')}
            initialModalState={modalState}
            data={value}
          />
        </Modal>
      )}
      <div className="grid grid-flow-col place-content-start items-center gap-3 px-2 py-1.5">
        <Text className="w-64 font-medium">{envVar}</Text>

        {modal && (
          <div className="-my-[4px] grid grid-flow-col gap-1">
            <Button
              variant="borderless"
              onClick={() => setModalState('SHOW')}
              size="small"
              className="min-w-0"
            >
              Reveal
            </Button>
            <span className="self-center align-text-bottom text-sm text-gray-600">
              or
            </span>
            <Button
              variant="borderless"
              onClick={() => setModalState('EDIT')}
              size="small"
              className="min-w-0"
            >
              Edit
            </Button>
          </div>
        )}

        {!modal && !sensitive && <Text className="break-all">{value}</Text>}
        {!modal && sensitive && <SensitiveValue value={value} />}
      </div>
    </>
  );
}

export default function EnvironmentVariablesPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data } = useGetAppInjectedVariablesQuery({
    variables: { id: currentApplication?.id },
    skip: !currentApplication,
  });

  if (
    !currentApplication?.subdomain ||
    !currentApplication?.hasuraGraphqlAdminSecret
  ) {
    return <LoadingScreen />;
  }

  const baseUrl = generateRemoteAppUrl(currentApplication?.subdomain);

  return (
    <Container>
      <EnvHeader />
      <AppEnvironmentVariables />
      <SectionContainer title="System Variables">
        <SystemVariable
          envVar="NHOST_ADMIN_SECRET"
          value={currentApplication.hasuraGraphqlAdminSecret}
          sensitive
        />
        <SystemVariable
          envVar="NHOST_WEBHOOK_SECRET"
          value={data?.app?.webhookSecret}
          sensitive
        />
        <SystemVariable
          envVar="NHOST_JWT_SECRET"
          value={JSON.stringify(
            data?.app?.hasuraGraphqlJwtSecret || '',
          ).replace(/\\/g, '')}
          modal
          systemVariableModal={JWTSecretModal}
        />
        <SystemVariable envVar="NHOST_BACKEND_URL" value={baseUrl} />
      </SectionContainer>
    </Container>
  );
}

EnvironmentVariablesPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
