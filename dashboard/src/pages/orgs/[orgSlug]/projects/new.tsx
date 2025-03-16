import { useUI } from '@/components/common/UIProvider';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSubmitState } from '@/hooks/useSubmitState';
import {
  useInsertOrgApplicationMutation,
  usePrefetchNewAppQuery,
  type GetOrganizationsQuery,
  type PrefetchNewAppRegionsFragment,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { getErrorMessage } from '@/utils/getErrorMessage';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import slugify from 'slugify';
import { twMerge } from 'tailwind-merge';

type NewAppPageProps = {
  regions: PrefetchNewAppRegionsFragment[];
  orgs: GetOrganizationsQuery['organizations'];
  preSelectedOrg: GetOrganizationsQuery['organizations'][0];
  preSelectedRegion: PrefetchNewAppRegionsFragment;
};

export function NewProjectPageContent({
  regions,
  orgs,
  preSelectedOrg,
  preSelectedRegion,
}: NewAppPageProps) {
  const { maintenanceActive } = useUI();
  const router = useRouter();

  // form
  const [name, setName] = useState('');

  const [selectedOrg, setSelectedOrg] = useState({
    id: preSelectedOrg.id,
    name: preSelectedOrg.name,
    disabled: false,
    slug: preSelectedOrg.slug,
  });

  const [selectedRegion, setSelectedRegion] = useState({
    id: preSelectedRegion.id,
    name: preSelectedRegion.city,
    disabled: false,
    code: preSelectedRegion.country.code,
  });

  const { submitState, setSubmitState } = useSubmitState();

  const [insertApp] = useInsertOrgApplicationMutation();

  // options
  const orgOptions = orgs.map((org) => ({
    id: org.id,
    name: `${org.name}`,
    disabled: false,
    slug: org.slug,
  }));

  const regionOptions = regions.map((region) => ({
    id: region.id,
    name: region.city,
    code: region.country.code,
    country: region.country.name,
    active: region.active,
    disabled: !region.active,
  }));

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();

    setSubmitState({
      error: null,
      loading: true,
    });

    if (name.length < 1 || name.length > 32) {
      setSubmitState({
        error: Error('The project name must be between 1 and 32 characters'),
        loading: false,
      });
      return;
    }

    const slug = slugify(name, { lower: true, strict: true });

    await execPromiseWithErrorToast(
      async () => {
        const { data: { insertApp: { subdomain } = {} } = {} } =
          await insertApp({
            variables: {
              app: {
                name,
                slug,
                organizationID: selectedOrg.id,
                regionId: selectedRegion.id,
              },
            },
          });

        if (subdomain) {
          await router.push(`/orgs/${selectedOrg.slug}/projects/${subdomain}`);
        }
      },
      {
        loadingMessage: 'Creating the project...',
        successMessage: 'The project has been created successfully.',
        errorMessage:
          'An error occurred while creating the project. Please try again.',
        onError: () => {
          setSubmitState({
            error: null,
            loading: false,
          });
        },
      },
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    handleCreateProject(event);
  }

  if (!selectedOrg) {
    return (
      <Container>
        <Box className="mx-auto my-64 max-w-full subpixel-antialiased">
          <div className="relative transform">
            <div className="mx-auto max-w-3xl text-center">
              <Text variant="h1" className="text-center text-6xl font-semibold">
                Organization Error
              </Text>
              <Text className="mt-2">
                There is no organization. You must create an organization before
                creating a project.
              </Text>
            </div>
          </div>
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <form onSubmit={handleSubmit}>
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
                setName(event.target.value);
              }}
              value={name}
              autoFocus
            />

            <Select
              id="organization"
              label="Organization"
              variant="inline"
              hideEmptyHelperText
              placeholder="Select an organization"
              slotProps={{
                root: { className: 'grid grid-flow-col gap-1' },
              }}
              onChange={(_event, value) => {
                const orgInList = orgs.find(({ id }) => id === value);

                setSelectedOrg({
                  id: orgInList.id,
                  name: orgInList.name,
                  disabled: false,
                  slug: orgInList.slug,
                });
              }}
              value={selectedOrg.id}
              renderValue={(option) => (
                <span className="inline-grid grid-flow-col items-center gap-2">
                  {option?.label}
                </span>
              )}
            >
              {orgOptions.map((option) => (
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
                  name: regionInList.city,
                  disabled: false,
                  code: regionInList.country.code,
                });
              }}
              value={selectedRegion.id}
              renderValue={() => (
                <div className="relative grid grid-flow-col items-center justify-start gap-x-3">
                  <span className="row-span-2 flex">
                    <Image
                      src={`/assets/flags/${selectedRegion.code}.svg`}
                      alt={`${selectedRegion.name} country flag`}
                      width={16}
                      height={12}
                    />
                  </span>

                  <Text variant="body1" className="row-span-1">
                    {selectedRegion.name}
                  </Text>
                </div>
              )}
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
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      Disabled
                    </Text>
                  )}
                </Option>
              ))}
            </Select>
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
            <Button
              type="submit"
              loading={submitState.loading}
              disabled={maintenanceActive}
              id="create-app"
            >
              Create Project
            </Button>
          </div>
        </div>
      </form>
    </Container>
  );
}

export default function NewProjectPage() {
  const { currentOrg, orgs, loading: loadingOrgs } = useOrgs();
  const { data, loading: loadingPlans, error } = usePrefetchNewAppQuery();

  if (error) {
    throw error;
  }

  if (loadingOrgs || loadingPlans || !data) {
    return <ActivityIndicator delay={500} label="Loading regions..." />;
  }

  const { regions } = data;

  // get pre-selected workspace
  // use query param to get workspace or just pick first workspace
  const preSelectedOrg = currentOrg || orgs[0];
  const preSelectedRegion = regions.find((region) => region.active);

  return (
    <div className="flex h-full w-full items-start justify-center p-4">
      <div className="flex w-full max-w-4xl flex-col items-center justify-center space-y-8 overflow-hidden rounded-md">
        <NewProjectPageContent
          regions={regions}
          orgs={orgs}
          preSelectedOrg={preSelectedOrg}
          preSelectedRegion={preSelectedRegion}
        />
      </div>
    </div>
  );
}

NewProjectPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
