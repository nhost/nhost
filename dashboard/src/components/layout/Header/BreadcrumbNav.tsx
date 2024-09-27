import {
  Slash
} from 'lucide-react';
import { useMemo } from 'react';

import { Logo } from '@/components/presentational/Logo';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator
} from '@/components/ui/v3/breadcrumb';
import { useCurrentOrg } from '@/features/projects/common/hooks/useCurrentOrg';
import { useRouter } from 'next/router';
import NavComboBox from './NavComboBox';
import OrgsComboBox from './OrgsComboBox';
import ProjectPagesComboBox from './ProjectPagesComboBox';
import ProjectsComboBox from './ProjectsComboBox';
import ProjectSettingsPagesComboBox from './ProjectSettingsPagesComboBox';



const orgPages = [
  { label: 'Settings', value: 'settings' },
  { label: 'Projects', value: 'projects' },
  { label: 'Members', value: 'members' },
  { label: 'Billing', value: 'billing' },
];

export default function BreadcrumbNav() {
  const router = useRouter();

  const { org } = useCurrentOrg()

  // Extract orgSlug and appSlug from router.query
  const { orgSlug, appSlug } = router.query;

  // Extract path segments from the URL
  const pathSegments = useMemo(() => router.asPath.split('/'), [router.asPath]);

  // Identify project and settings pages based on the URL pattern
  const isSettingsPage = pathSegments.includes('settings');
  const projectPage = pathSegments[3] || null;
  const settingsPage = isSettingsPage ? pathSegments[4] || null : null;
  const showNavigationBreadCrumbs = router.route !== '/orgs/verify';

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <div className="h-7 w-7">
            <Logo className="mx-auto cursor-pointer" />
          </div>
        </BreadcrumbItem>

        {showNavigationBreadCrumbs && (
          <>
            <BreadcrumbSeparator>
              <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
            </BreadcrumbSeparator>

            <BreadcrumbItem>
              <OrgsComboBox />
            </BreadcrumbItem>

            <BreadcrumbSeparator>
              <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
            </BreadcrumbSeparator>

            {projectPage && (
              <BreadcrumbItem>
                <NavComboBox
                  value={orgPages.find((p) => p.value === projectPage)}
                  options={orgPages}
                  onSelect={(projectPageOption) =>
                    router.push(`/orgs/${orgSlug}/${projectPageOption.value}`)
                  }
                />
              </BreadcrumbItem>
            )}
          </>
        )}

        {showNavigationBreadCrumbs && appSlug && (
          <>
            <BreadcrumbSeparator>
              <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
            </BreadcrumbSeparator>

            <BreadcrumbItem>
              <ProjectsComboBox />
            </BreadcrumbItem>

            <BreadcrumbSeparator>
              <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
            </BreadcrumbSeparator>

            <BreadcrumbItem>
              <ProjectPagesComboBox />
            </BreadcrumbItem>

            {
              isSettingsPage && (
                <>
                <BreadcrumbSeparator>
                  <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  <ProjectSettingsPagesComboBox />
                </BreadcrumbItem>
                </>
              )
            }
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
