import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { type ReactElement, useCallback, useEffect } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/v3/button';
import { ServicesOutlinedIcon } from '@/components/ui/v3/icons/ServicesOutlinedIcon';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
        className="grid grid-flow-row gap-6 bg-transparent"
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
      <Container>
        <Spinner size="medium" />
      </Container>
    );
  }

  if (services.length === 0 && !loading) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
        <div className="flex flex-row place-content-end">
          <Button onClick={openCreateServiceDialog} disabled={!isPlatform}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add service
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <ServicesOutlinedIcon className="h-10 w-10" />
          <div className="flex flex-col space-y-1">
            <h3 className="text-center font-medium text-lg">
              No custom services are available
            </h3>
            <p className="text-center text-muted-foreground text-sm">
              All your project&apos;s custom services will be listed here.
            </p>
          </div>
          {isPlatform ? (
            <div className="flex flex-row place-content-between rounded-lg">
              <Button className="w-full" onClick={openCreateServiceDialog}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Add service
              </Button>
            </div>
          ) : null}
        </div>
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
  return <OrgLayout>{page}</OrgLayout>;
};
