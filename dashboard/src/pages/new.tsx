import { BillingPaymentMethodForm } from '@/components/billing-payment-method/BillingPaymentMethodForm';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Container from '@/components/layout/Container';
import features from '@/data/features.json';
import { useGetAllUserWorkspacesAndApplications } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import { useLazyRefetchUserData } from '@/hooks/useLazyRefetchUserData';
import { useSubmitState } from '@/hooks/useSubmitState';
import { Alert } from '@/ui/Alert';
import { Modal } from '@/ui/Modal';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import type { TextProps } from '@/ui/v2/Text';
import Text from '@/ui/v2/Text';
import { MAX_FREE_APPS } from '@/utils/CONSTANTS';
import { copy } from '@/utils/copy';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { getCurrentEnvironment } from '@/utils/helpers';
import nhost from '@/utils/nhost';
import { planDescriptions } from '@/utils/planDescriptions';
import generateRandomDatabasePassword from '@/utils/settings/generateRandomDatabasePassword';
import { resetDatabasePasswordValidationSchema } from '@/utils/settings/resetDatabasePasswordValidationSchema';
import { triggerToast } from '@/utils/toast';
import type {
  CreateNewAppMutationVariables,
  PrefetchNewAppPlansFragment,
  PrefetchNewAppRegionsFragment,
  PrefetchNewAppWorkspaceFragment
} from '@/utils/__generated__/graphql';
import {
  useCreateNewAppMutation,
  usePrefetchNewAppQuery
} from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import { twMerge } from 'tailwind-merge';

type NewAppPageProps = {
  regions: PrefetchNewAppRegionsFragment[];
  plans: PrefetchNewAppPlansFragment[];
  workspaces: PrefetchNewAppWorkspaceFragment[];
  nrOfFreeAppsCreatedByUser: number;
  preSelectedWorkspace: PrefetchNewAppWorkspaceFragment;
  preSelectedRegion: PrefetchNewAppRegionsFragment;
};

export function NewProjectPageContent({
  regions,
  plans,
  workspaces,
  nrOfFreeAppsCreatedByUser,
  preSelectedWorkspace,
  preSelectedRegion,
}: NewAppPageProps) {
  const router = useRouter();
  // pre hook
  useGetAllUserWorkspacesAndApplications();

  // form
  const [name, setName] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [selectedWorkspace, setSelectedWorkspace] = useState({
    id: preSelectedWorkspace.id,
    name: preSelectedWorkspace.name,
    disabled: false,
    slug: preSelectedWorkspace.slug,
  });

  const [selectedRegion, setSelectedRegion] = useState({
    id: preSelectedRegion.id,
    name: preSelectedRegion.city,
    disabled: false,
    code: preSelectedRegion.country.code,
  });

  const [databasePassword, setDatabasePassword] = useState(
    generateRandomDatabasePassword(),
  );

  // find the first acceptable plan as default plan
  const defaultSelectedPlan = plans.find((plan) => {
    if (!plan.isFree) {
      return true;
    }
    return nrOfFreeAppsCreatedByUser < MAX_FREE_APPS;
  });

  const [plan, setPlan] = useState(defaultSelectedPlan);

  // state
  const { submitState, setSubmitState } = useSubmitState();
  const [applicationError, setApplicationError] = useState<any>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // graphql mutations
  const [createNewApp] = useCreateNewAppMutation();
  const { refetchUserData } = useLazyRefetchUserData();

  // options
  const workspaceOptions = workspaces.map((workspace) => ({
    id: workspace.id,
    name: `${workspace.name}`,
    disabled: false,
    slug: workspace.slug,
  }));

  const regionOptions = regions.map((region) => ({
    id: region.id,
    name: region.city,
    code: region.country.code,
    country: region.country.name,
    active: region.active,
    disabled: !region.active,
  }));

  // variables
  const workspace = workspaces.find(
    (availableWorkspace) => availableWorkspace.id === selectedWorkspace.id,
  );

  const isK8SPostgresEnabledInCurrentEnvironment = features[
    'k8s-postgres'
  ].enabled.find((e) => e === getCurrentEnvironment());

  // function handlers
  const handleGenerateRandomPassword = () => {
    const newRandomDatabasePassword = generateRandomDatabasePassword();
    setPasswordError('');
    triggerToast('New random database password generated.');
    setDatabasePassword(newRandomDatabasePassword);
  };

  const handleSubmit = async () => {
    setSubmitState({
      error: null,
      loading: true,
    });

    if (name.length < 1 || name.length > 32) {
      setApplicationError(
        `The project name must be between 1 and 32 characters`,
      );
      setSubmitState({
        error: null,
        loading: false,
      });
    }

    if (isK8SPostgresEnabledInCurrentEnvironment) {
      try {
        await resetDatabasePasswordValidationSchema.validate({
          databasePassword,
        });
      } catch (validationError) {
        setSubmitState({
          error: Error(validationError.errors),
          loading: false,
        });
      }
    }

    let projectSlug = '';

    try {
      const variables = {
        name,
        planId: plan.id,
        workspaceId: selectedWorkspace.id,
        regionId: selectedRegion.id,
        postgresPassword: isK8SPostgresEnabledInCurrentEnvironment
          ? databasePassword
          : undefined,
      } as CreateNewAppMutationVariables;

      const { data } = await createNewApp({
        variables,
      });

      projectSlug = data.createNewApp.slug;

      triggerToast(`New project ${name} created`);
    } catch (error) {
      setSubmitState({
        error: Error(getErrorMessage(error, 'application')),
        loading: false,
      });

      return;
    }

    await refetchUserData();
    router.push(`/${selectedWorkspace.slug}/${projectSlug}`);
  };

  if (!selectedWorkspace) {
    return (
      <Container>
        <Box className="mx-auto my-64 max-w-full subpixel-antialiased">
          <div className="relative transform">
            <div className="mx-auto max-w-3xl text-center">
              <Text variant="h1" className="text-center text-6xl font-semibold">
                Workspace Error
              </Text>
              <Text className="mt-2">
                There is no workspace. You must create a workspace before
                creating an application.
              </Text>
            </div>
          </div>
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mx-auto grid max-w-[760px] grid-flow-row gap-4 py-6 sm:py-14">
        <Text variant="h2" component="h1">
          New Project
        </Text>

        <div className="grid grid-flow-row gap-4">
          <Input
            id="name"
            autoComplete="off"
            label="Project Name"
            variant="inline"
            fullWidth
            hideEmptyHelperText
            placeholder="Project Name"
            onChange={(event) => {
              setSubmitState({
                error: null,
                loading: false,
              });
              setApplicationError('');
              setName(event.target.value);
            }}
            value={name}
            autoFocus
          />

          <Select
            id="workspace"
            label="Workspace"
            variant="inline"
            hideEmptyHelperText
            placeholder="Select Workspace"
            slotProps={{
              root: { className: 'grid grid-flow-col gap-1' },
            }}
            onChange={(_event, value) => {
              const workspaceInList = workspaces.find(({ id }) => id === value);
              setPlan(plans[0]);
              setSelectedWorkspace({
                id: workspaceInList.id,
                name: workspaceInList.name,
                disabled: false,
                slug: workspaceInList.slug,
              });
            }}
            value={selectedWorkspace.id}
            renderValue={(option) => (
              <span className="inline-grid grid-flow-col items-center gap-2">
                {option?.label}
              </span>
            )}
          >
            {workspaceOptions.map((option) => (
              <Option
                value={option.id}
                key={option.id}
                className="grid grid-flow-col items-center gap-2"
              >
                <span className="inline-block h-6 w-6 overflow-hidden rounded-md">
                  <Image
                    src="/logos/new.svg"
                    alt="Nhost Logo"
                    width={24}
                    height={24}
                  />
                </span>

                {option.name}
              </Option>
            ))}
          </Select>

          {isK8SPostgresEnabledInCurrentEnvironment && (
            <Input
              name="databasePassword"
              id="databasePassword"
              autoComplete="new-password"
              label="Database Password"
              value={databasePassword}
              variant="inline"
              type="password"
              error={!!passwordError}
              hideEmptyHelperText
              endAdornment={
                <InputAdornment position="end" className="mr-2">
                  <IconButton
                    color="secondary"
                    onClick={() => {
                      copy(databasePassword, 'Postgres password');
                    }}
                    variant="borderless"
                    aria-label="Copy password"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </IconButton>
                </InputAdornment>
              }
              slotProps={{
                // Note: this is supposed to fix a `validateDOMNesting` error
                helperText: { component: 'div' },
              }}
              helperText={
                <div className="grid max-w-xs grid-flow-row gap-2">
                  {passwordError && (
                    <Text
                      variant="subtitle2"
                      sx={{
                        color: (theme) =>
                          `${theme.palette.error.main} !important`,
                      }}
                    >
                      {passwordError}
                    </Text>
                  )}

                  <Box className="font-medium">
                    The root Postgres password for your database - it must be
                    strong and hard to guess.{' '}
                    <Button
                      type="button"
                      variant="borderless"
                      color="secondary"
                      onClick={handleGenerateRandomPassword}
                      className="px-1 py-0.5 text-xs underline underline-offset-2 hover:underline"
                      tabIndex={-1}
                    >
                      Generate a password
                    </Button>
                  </Box>
                </div>
              }
              onChange={async (e) => {
                e.preventDefault();
                setSubmitState({
                  error: null,
                  loading: false,
                });
                if (e.target.value.length === 0) {
                  setDatabasePassword(e.target.value);
                  setPasswordError('Please enter a password');

                  return;
                }
                setDatabasePassword(e.target.value);
                setPasswordError('');
                try {
                  await resetDatabasePasswordValidationSchema.validate({
                    databasePassword: e.target.value,
                  });
                  setPasswordError('');
                } catch (validationError) {
                  setPasswordError(validationError.message);
                }
              }}
              fullWidth
            />
          )}

          <Select
            id="region"
            label="Region"
            variant="inline"
            hideEmptyHelperText
            placeholder="Select Region"
            slotProps={{
              root: { className: 'grid grid-flow-col gap-1' },
            }}
            onChange={(_event, value) => {
              const regionInList = regions.find(({ id }) => id === value);
              setSelectedRegion({
                id: regionInList.id,
                name: regionInList.country.name,
                disabled: false,
                code: regionInList.country.code,
              });
            }}
            value={selectedRegion.id}
            renderValue={(option) => {
              const [flag, , country] = (option?.label as any[]) || [];

              return (
                <span className="inline-grid grid-flow-col grid-rows-none items-center gap-x-2">
                  {flag}

                  {isValidElement<TextProps>(country)
                    ? cloneElement(country, {
                        ...country.props,
                        variant: 'body1',
                      })
                    : null}
                </span>
              );
            }}
          >
            {regionOptions.map((option) => (
              <Option
                value={option.id}
                key={option.id}
                className={twMerge(
                  'relative grid grid-flow-col grid-rows-2 items-center justify-start gap-x-3',
                  option.disabled && 'pointer-events-none opacity-50',
                )}
                disabled={option.disabled}
              >
                <span className="row-span-2 flex">
                  <Image
                    src={`/assets/flags/${option.code}.svg`}
                    alt={`${option.country} country flag`}
                    width={16}
                    height={12}
                  />
                </span>

                <Text className="row-span-1 font-medium">{option.name}</Text>

                <Text variant="subtitle2" className="row-span-1">
                  {option.country}
                </Text>

                {option.disabled && (
                  <Text
                    variant="subtitle2"
                    className="absolute top-1/2 right-4 -translate-y-1/2"
                  >
                    Disabled
                  </Text>
                )}
              </Option>
            ))}
          </Select>

          <div className="grid w-full grid-cols-8 gap-x-4 gap-y-2">
            <div className="col-span-8 sm:col-span-2">
              <Text className="text-xs font-medium">Plan</Text>
              <Text variant="subtitle2">You can change this later.</Text>
            </div>

            <div className="col-span-8 sm:col-span-6">
              {plans.map((currentPlan) => {
                const checked = plan.id === currentPlan.id;

                const disabledPlan =
                  currentPlan.isFree && nrOfFreeAppsCreatedByUser >= MAX_FREE_APPS;

                return (
                  <Box
                    className="border-t py-4 last-of-type:border-b"
                    key={currentPlan.id}
                  >
                    <Checkbox
                      disabled={disabledPlan}
                      label={
                        <>
                          <span className="inline-block max-w-xs">
                            <span className="font-medium">
                              {currentPlan.name}:
                            </span>{' '}
                            {planDescriptions[currentPlan.name]}
                            {disabledPlan && (
                              <div className="font-bold text-red-700">
                                Diasbled: You can create max 1 free project.
                              </div>
                            )}
                          </span>

                          {currentPlan.isFree ? (
                            <Text variant="h3" component="span">
                              Free
                            </Text>
                          ) : (
                            <Text
                              variant="h3"
                              component="span"
                              className="inline-grid grid-flow-col items-center gap-1"
                            >
                              $ {currentPlan.price}{' '}
                              <Text variant="subtitle2" component="span">
                                / mo
                              </Text>
                            </Text>
                          )}
                        </>
                      }
                      componentsProps={{
                        formControlLabel: {
                          className: 'flex',
                          componentsProps: {
                            typography: {
                              className:
                                'font-regular text-xs grid grid-flow-col justify-between items-center w-full',
                            },
                          },
                        },
                      }}
                      checked={checked}
                      key={currentPlan.id}
                      onChange={(event, inputChecked) => {
                        if (!inputChecked) {
                          event.preventDefault();

                          return;
                        }

                        setPlan(currentPlan);
                      }}
                    />
                  </Box>
                );
              })}
            </div>
          </div>
        </div>

        {submitState.error && (
          <Alert severity="error" className="text-left">
            <Text className="font-medium">Error</Text>{' '}
            <Text className="font-medium">
              {submitState.error &&
                getErrorMessage(submitState.error, 'application')}{' '}
            </Text>
          </Alert>
        )}

        <div className="flex justify-end">
          {showPaymentModal && (
            <Modal
              showModal={showPaymentModal}
              close={() => {
                setShowPaymentModal(false);
              }}
            >
              <BillingPaymentMethodForm
                close={() => {
                  setShowPaymentModal(false);
                }}
                onPaymentMethodAdded={handleSubmit}
                workspaceId={workspace.id}
              />
            </Modal>
          )}

          <Button
            onClick={() => {
              if (!plan.isFree && workspace.paymentMethods.length === 0) {
                setShowPaymentModal(true);

                return;
              }

              handleSubmit();
            }}
            type="submit"
            loading={submitState.loading}
            disabled={
              !!applicationError || !!submitState.error || !!passwordError
            }
            id="create-app"
          >
            Create Project
          </Button>
        </div>
      </div>
    </Container>
  );
}

export default function NewProjectPage() {
  const user = nhost.auth.getUser();

  const { data, loading, error } = usePrefetchNewAppQuery({
    variables: {
      userId: user.id,
    },
  });
  const router = useRouter();

  if (error) {
    throw error;
  }

  if (loading) {
    return (
      <ActivityIndicator delay={500} label="Loading plans and regions..." />
    );
  }

  const { workspace } = router.query;

  const { regions, plans, workspaces } = data;

  // get pre-selected workspace
  // use query param to get workspace or just pick first workspace
  const preSelectedWorkspace = workspace
    ? workspaces.find((w) => w.slug === workspace)
    : workspaces[0];

  const preSelectedRegion = regions.filter((region) => region.active)[0];

  // the `apps` property is filtered by the GraphQL query
  const nrOfFreeAppsCreatedByUser = data.apps.length;

  return (
    <NewProjectPageContent
      regions={regions}
      plans={plans}
      workspaces={workspaces}
      nrOfFreeAppsCreatedByUser={nrOfFreeAppsCreatedByUser}
      preSelectedWorkspace={preSelectedWorkspace}
      preSelectedRegion={preSelectedRegion}
    />
  );
}

NewProjectPage.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticatedLayout title="New Project">{page}</AuthenticatedLayout>;
};
