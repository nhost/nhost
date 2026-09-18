import { Check, Info } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import slugify from 'slugify';
import { Container } from '@/components/layout/Container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrganizationLayout } from '@/features/orgs/layout/OrganizationLayout';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getCreateProjectErrorMessage } from '@/features/orgs/utils/getCreateProjectErrorMessage';
import {
  type GetOrganizationsQuery,
  type PrefetchNewAppRegionsFragment,
  useInsertOrgApplicationMutation,
  usePrefetchNewAppQuery,
} from '@/generated/graphql';
import { useSubmitState } from '@/hooks/useSubmitState';
import { analytics } from '@/lib/segment';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/getErrorMessage';

type NewAppPageProps = {
  regions: PrefetchNewAppRegionsFragment[];
  preSelectedOrg: GetOrganizationsQuery['organizations'][0];
  preSelectedRegion: PrefetchNewAppRegionsFragment;
};

interface RegionCardProps {
  selected: boolean;
  disabled: boolean;
  name: string;
  country: string;
  code: string;
  onSelect: () => void;
  onHoverChange: (hovered: boolean) => void;
}

/** Selectable region card used by the region grid below. */
function RegionCard({
  selected,
  disabled,
  name,
  country,
  code,
  onSelect,
  onHoverChange,
}: RegionCardProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: custom radio-group option, not a native form control
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
        selected
          ? 'border-primary bg-primary/[0.06]'
          : 'border-border bg-background hover:border-primary',
      )}
    >
      <Image
        src={`/assets/flags/${code}.svg`}
        alt={`${country} country flag`}
        width={16}
        height={12}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground text-sm">
          {name}
        </span>
        <span className="block truncate text-muted-foreground text-xs">
          {country}
        </span>
      </span>
      {disabled ? (
        <span className="shrink-0 text-muted-foreground text-xs">Disabled</span>
      ) : (
        selected && <Check className="h-4 w-4 shrink-0 text-primary" />
      )}
    </button>
  );
}

// Playful per-region greeting shown when hovering/selecting a region, matching the
// Lovable reference design. Falls back to a generic greeting for any region not
// listed here (e.g. new regions added after this list was written).
const REGION_GREETINGS: Record<string, string> = {
  frankfurt: "Hallo, wie geht's?",
  london: "Hello. How's it going?",
  mumbai: 'Namaste, kaise ho?',
  'n. virginia': "Hey, how's it going?",
  'north virginia': "Hey, how's it going?",
  oregon: 'Hey there!',
  'são paulo': 'Oi, tudo bem?',
  'sao paulo': 'Oi, tudo bem?',
  singapore: 'Hello, ready to build?',
  sydney: "G'day, how are ya?",
  stockholm: 'Hej, hur mår du?',
};

function getRegionGreeting(cityName: string) {
  return REGION_GREETINGS[cityName.toLowerCase()] ?? 'Hello! Ready to build?';
}

export function NewProjectPageContent({
  regions,
  preSelectedOrg,
  preSelectedRegion,
}: NewAppPageProps) {
  const router = useRouter();

  // form
  const [name, setName] = useState('');

  const selectedOrg = {
    id: preSelectedOrg.id,
    name: preSelectedOrg.name,
    slug: preSelectedOrg.slug,
  };

  const [selectedRegion, setSelectedRegion] = useState({
    id: preSelectedRegion.id,
    name: preSelectedRegion.city,
    disabled: false,
    code: preSelectedRegion.country.code,
  });

  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  const { submitState, setSubmitState } = useSubmitState();

  const [insertApp] = useInsertOrgApplicationMutation();

  // options
  const regionOptions = regions.map((region) => ({
    id: region.id,
    name: region.city,
    code: region.country.code,
    country: region.country.name,
    active: region.active,
    disabled: !region.active,
  }));

  const previewRegion =
    regionOptions.find((option) => option.id === hoveredRegionId) ??
    regionOptions.find((option) => option.id === selectedRegion.id);

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
        const { data } = await insertApp({
          variables: {
            app: {
              name,
              slug,
              organizationID: selectedOrg.id,
              regionId: selectedRegion.id,
            },
          },
        });
        if (data?.insertApp?.subdomain) {
          const { subdomain } = data.insertApp;
          analytics.track('Project Created', {
            projectName: name,
            projectSlug: slug,
            organizationId: selectedOrg.id,
            organizationName: selectedOrg.name,
            regionId: selectedRegion.id,
            regionName: selectedRegion.name,
          });

          // store the subdomain in session storage to indicate that the user has created a project
          sessionStorage.setItem('newProjectSubdomain', subdomain);
          await router.push(`/orgs/${selectedOrg.slug}/projects/${subdomain}`);
        }
      },
      {
        loadingMessage: 'Creating the project...',
        successMessage: 'The project has been created successfully.',
        errorMessage: getCreateProjectErrorMessage,
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
        <div className="mx-auto my-64 max-w-full subpixel-antialiased">
          <div className="relative transform">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-center font-semibold text-6xl">
                Organization Error
              </h1>
              <p className="mt-2 text-sm">
                There is no organization. You must create an organization before
                creating a project.
              </p>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto bg-accent-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 pt-8 pb-16">
        <h1 className="mb-6 font-semibold text-3xl">Create project</h1>

        <form
          onSubmit={handleSubmit}
          className="grid w-full max-w-[760px] grid-flow-row gap-4"
        >
          <div className="grid grid-flow-row gap-4">
            <div className="grid gap-1 sm:grid-cols-8 sm:items-center sm:gap-4 sm:py-3">
              <label
                htmlFor="name"
                className="font-medium text-sm+ sm:col-span-2"
              >
                Project name
              </label>
              <Input
                id="name"
                autoComplete="off"
                placeholder="Project name"
                wrapperClassName="sm:col-span-6"
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
            </div>

            <div className="grid gap-1 sm:grid-cols-8 sm:gap-4 sm:py-3">
              <span className="font-medium text-sm+ sm:col-span-2">Region</span>
              <div className="sm:col-span-6">
                <div
                  role="radiogroup"
                  aria-label="Region"
                  className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {regionOptions.map((option) => (
                    <RegionCard
                      key={option.id}
                      selected={option.id === selectedRegion.id}
                      disabled={option.disabled}
                      name={option.name}
                      country={option.country}
                      code={option.code}
                      onSelect={() => {
                        if (option.disabled) {
                          return;
                        }

                        setSelectedRegion({
                          id: option.id,
                          name: option.name,
                          disabled: false,
                          code: option.code,
                        });
                      }}
                      onHoverChange={(hovered) =>
                        setHoveredRegionId(hovered ? option.id : null)
                      }
                    />
                  ))}
                </div>

                {previewRegion && (
                  <Alert className="mt-3 border-border bg-secondary-200">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <AlertTitle className="flex items-center gap-2">
                      <Image
                        src={`/assets/flags/${previewRegion.code}.svg`}
                        alt={`${previewRegion.country} country flag`}
                        width={16}
                        height={12}
                      />
                      {getRegionGreeting(previewRegion.name)}
                    </AlertTitle>
                    <AlertDescription>
                      This is where your project&apos;s servers will physically
                      run. Pick the one closest to where most of your users are
                      for faster load times.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>

          {submitState.error && (
            <Alert variant="destructive" className="text-left">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {submitState.error &&
                  getErrorMessage(submitState.error, 'application')}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline-emboss"
              onClick={() => router.push(`/orgs/${selectedOrg.slug}/projects`)}
            >
              Cancel
            </Button>
            <ButtonWithLoading
              type="submit"
              size="sm"
              loading={submitState.loading}
              id="create-app"
            >
              Create project
            </ButtonWithLoading>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewProjectPage() {
  const { currentOrg, orgs, loading: loadingOrgs } = useOrgs();
  const { data, loading: loadingPlans, error } = usePrefetchNewAppQuery();

  if (error) {
    throw error;
  }

  if (loadingOrgs || loadingPlans || !data) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading regions...
      </Spinner>
    );
  }

  const { regions } = data;

  // get pre-selected organization
  // use query param to get organization or just pick first organization
  const preSelectedOrg = currentOrg || orgs[0];
  const preSelectedRegion = regions.find((region) => region.active)!;

  return (
    <NewProjectPageContent
      regions={regions}
      preSelectedOrg={preSelectedOrg}
      preSelectedRegion={preSelectedRegion}
    />
  );
}

NewProjectPage.getLayout = function getLayout(page: ReactElement) {
  return <OrganizationLayout>{page}</OrganizationLayout>;
};
