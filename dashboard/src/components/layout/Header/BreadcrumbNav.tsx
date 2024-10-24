import { Slash } from 'lucide-react';
import { useMemo } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/v3/breadcrumb';
import { useRouter } from 'next/router';
import OrgPagesComboBox from './OrgPagesComboBox';
import OrgsComboBox from './OrgsComboBox';
import ProjectPagesComboBox from './ProjectPagesComboBox';
import ProjectsComboBox from './ProjectsComboBox';
import ProjectSettingsPagesComboBox from './ProjectSettingsPagesComboBox';

export default function BreadcrumbNav() {
  const { query, asPath, route } = useRouter();

  // Extract orgSlug and appSlug from router.query
  const { appSlug, workspaceSlug } = query;

  // Extract path segments from the URL
  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);

  // Identify project and settings pages based on the URL pattern
  const projectPage = pathSegments[3] || null;
  const isSettingsPage = pathSegments[5] === 'settings';

  const showBreadcrumbs =
    !workspaceSlug && !['/', '/orgs/verify'].includes(route);

  return (
    <Breadcrumb className="flex flex-row w-full mt-2 overflow-x-auto flex-nowrap lg:mt-0 lg:overflow-visible">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbSeparator>
          <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
        </BreadcrumbSeparator>

        <BreadcrumbItem>
          <OrgsComboBox />
        </BreadcrumbItem>

        {showBreadcrumbs && (
          <>
            <BreadcrumbSeparator>
              <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
            </BreadcrumbSeparator>

            {projectPage && <OrgPagesComboBox />}
          </>
        )}

        {showBreadcrumbs && appSlug && (
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

            {isSettingsPage && (
              <>
                <BreadcrumbSeparator>
                  <Slash
                    strokeWidth={3.5}
                    className="text-muted-foreground/50"
                  />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  <ProjectSettingsPagesComboBox />
                </BreadcrumbItem>
              </>
            )}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
