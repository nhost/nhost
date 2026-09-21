import { SiGithub } from '@icons-pack/react-simple-icons';
import { Box, ChevronsUpDown, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import OrganizationLabel from '@/components/layout/Header/OrganizationLabel';
import OrganizationPlanBadge from '@/components/layout/Header/OrganizationPlanBadge';
import ProjectLabel from '@/components/layout/Header/ProjectLabel';
import SheetListItem from '@/components/layout/Header/SheetListItem';
import SheetListSection from '@/components/layout/Header/SheetListSection';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { getProjectFeaturePagePath } from '@/utils/getProjectFeaturePagePath';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * The org and project switchers as one trigger and a bottom drawer, for
 * viewports where the two header comboboxes do not fit.
 */
export default function HeaderNavigationSheet() {
  const isPlatform = useIsPlatform();
  const router = useRouter();
  const { orgs, currentOrg } = useOrgs();
  const [, setLastSlug] = useSSRLocalStorage<string | null>('slug', null);
  const [createOrganizationDialogOpen, setCreateOrganizationDialogOpen] =
    useState(false);

  if (!isPlatform) {
    return null;
  }

  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const currentProject = currentOrg?.apps.find(
    (app) => app.subdomain === appSubdomain,
  );

  function switchOrganization(slug: string) {
    setLastSlug(slug);
    router.push(`/orgs/${slug}/projects`);
  }

  function switchProject(subdomain: string) {
    if (!currentOrg) {
      return;
    }

    router.push(
      `/orgs/${currentOrg.slug}/projects/${subdomain}${getProjectFeaturePagePath(router.pathname)}`,
    );
  }

  return (
    <>
      <CreateOrgDialog
        hideNewOrgButton
        isOpen={createOrganizationDialogOpen}
        onOpenStateChange={setCreateOrganizationDialogOpen}
      />

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            aria-label="Switch organization or project"
            className="h-9 min-w-0 flex-1 justify-between gap-2 px-3 font-medium"
          >
            {currentProject ? (
              <ProjectLabel name={currentProject.name} />
            ) : currentOrg ? (
              <OrganizationLabel organization={currentOrg} />
            ) : (
              <span className="flex-1 truncate text-left text-muted-foreground">
                Select organization
              </span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          showOverlay
          className="max-h-[80vh] overflow-y-auto rounded-t-xl p-0"
        >
          <SheetTitle className="sr-only">
            Switch organization or project
          </SheetTitle>
          <SheetDescription className="sr-only">
            Pick an organization or one of its projects to navigate to.
          </SheetDescription>

          <SheetListSection label="Organizations">
            {orgs.map((org) => (
              <SheetListItem
                key={org.slug}
                current={org.slug === currentOrg?.slug}
                onClick={() => switchOrganization(org.slug)}
              >
                <span className="truncate">{org.name}</span>
                <OrganizationPlanBadge plan={org.plan?.name} />
              </SheetListItem>
            ))}
            <SheetListItem
              onClick={() => setCreateOrganizationDialogOpen(true)}
            >
              <Plus className="size-4 shrink-0" />
              New Organization
            </SheetListItem>
          </SheetListSection>

          {currentOrg && (
            <>
              <Separator />

              <SheetListSection label="Projects">
                {currentOrg.apps.map((app) => (
                  <SheetListItem
                    key={app.subdomain}
                    current={app.subdomain === currentProject?.subdomain}
                    onClick={() => switchProject(app.subdomain)}
                  >
                    <Box className="size-4 shrink-0" />
                    <span className="truncate">{app.name}</span>
                    {!!app.githubRepository && (
                      <SiGithub className="size-3.5 shrink-0" />
                    )}
                  </SheetListItem>
                ))}
                <SheetListItem
                  onClick={() =>
                    router.push(`/orgs/${currentOrg.slug}/projects/new`)
                  }
                >
                  <Plus className="size-4 shrink-0" />
                  New Project
                </SheetListItem>
              </SheetListSection>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
