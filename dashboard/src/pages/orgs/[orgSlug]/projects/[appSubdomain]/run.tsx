import { SiDocker as ServicesIcon } from '@icons-pack/react-simple-icons';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { type ReactElement, useCallback, useEffect } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RunArea } from '@/features/orgs/projects/run/layout';
import { ServiceDrawerTitle } from '@/features/orgs/projects/services/components/ServiceDrawerTitle';
import { ServiceForm } from '@/features/orgs/projects/services/components/ServiceForm';
import { ServicesList } from '@/features/orgs/projects/services/components/ServicesList';
import { parseConfigFromInstallLink } from '@/features/orgs/projects/services/utils/parseConfigFromInstallLink';

export default function RunPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { openDrawer, openAlertDialog } = useDialog();
  const { org } = useCurrentOrg();
  const { loading: loadingProject } = useProject();

  const {
    loading,
    services,
    totalServicesCount,
    limit,
    nrOfPages,
    currentPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    refetch,
  } = useRunServices();

  const isPlanFree = org?.plan?.isFree;

  const checkConfigFromQuery = useCallback(
    (base64Config: string) => {
      if (!router.query?.config) {
        return;
      }

      try {
        const initialData = parseConfigFromInstallLink(base64Config);

        openDrawer({
          title: (
            <ServiceDrawerTitle>Create a new run service</ServiceDrawerTitle>
          ),
          component: (
            <ServiceForm initialData={initialData} onSubmit={refetch} />
          ),
        });
      } catch {
        openAlertDialog({
          title: 'Configuration not set properly',
          payload: 'The service configuration was not properly encoded',
          props: {
            primaryButtonText: 'Ok',
            hideSecondaryAction: true,
          },
        });
      }
    },
    [router.query.config, openDrawer, refetch, openAlertDialog],
  );

  useEffect(() => {
    if (router.query?.config) {
      checkConfigFromQuery(router.query.config as string);
    }
  }, [checkConfigFromQuery, router.query]);

  const openCreateServiceDialog = () => {
    // creating services using the local dashboard is not supported
    if (!isPlatform) {
      return;
    }

    openDrawer({
      title: <ServiceDrawerTitle>Create a new service</ServiceDrawerTitle>,
      component: <ServiceForm onSubmit={refetch} />,
    });
  };

  if (isPlatform && isPlanFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent pt-8 pb-8"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          section="run"
          title="To unlock Nhost Run, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  if (loading && loadingProject) {
    return (
      <Container className="pt-8 pb-8">
        <Spinner size="medium" />
      </Container>
    );
  }

  if (services.length === 0 && !loading) {
    return (
      <Container
        className="mx-auto flex h-full max-w-9xl flex-col space-y-5 overflow-x-hidden pt-8 pb-8"
        rootClassName="h-full"
      >
        <div className="flex flex-row place-content-end">
          <Button onClick={openCreateServiceDialog} disabled={!isPlatform}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add service
          </Button>
        </div>

        <EmptyState
          icon={ServicesIcon}
          title="No custom services are available"
          description="All your project's custom services will be listed here."
          action={
            isPlatform ? (
              <div className="flex flex-row place-content-between rounded-lg">
                <Button className="w-full" onClick={openCreateServiceDialog}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add service
                </Button>
              </div>
            ) : null
          }
        />
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-row place-content-end border-b-1 p-4">
        <Button onClick={openCreateServiceDialog} disabled={!isPlatform}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add service
        </Button>
      </div>
      <div className="space-y-4">
        <ServicesList
          services={services}
          onDelete={() => refetch()}
          onCreateOrUpdate={() => refetch()}
        />
        {isPlatform ? (
          <Pagination
            className="px-2"
            totalNrOfPages={nrOfPages}
            currentPageNumber={currentPage}
            totalNrOfElements={totalServicesCount}
            itemsLabel="services"
            elementsPerPage={limit}
            onPrevPageClick={goToPreviousPage}
            onNextPageClick={goToNextPage}
            onPageChange={goToPage}
          />
        ) : null}
      </div>
    </div>
  );
}

RunPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <RunArea>{page}</RunArea>
      </ProjectScope>
    </AppLayout>
  );
};
