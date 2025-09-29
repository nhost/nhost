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
import ProjectGraphQLPagesComboBox from './ProjectGraphQLPagesComboBox';
import ProjectPagesComboBox from './ProjectPagesComboBox';
import ProjectsComboBox from './ProjectsComboBox';
import ProjectSettingsPagesComboBox from './ProjectSettingsPagesComboBox';

export default function BreadcrumbNav() {
  const { query, asPath, route } = useRouter();

  const { appSubdomain } = query;

  // Extract path segments from the URL
  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);

  // Identify project and settings pages based on the URL pattern
  const projectPage = pathSegments[3] || null;
  const isSettingsPage = pathSegments[5] === 'settings';
  const isGraphQLPage = pathSegments[5] === 'graphql';

  const showBreadcrumbs = !['/', '/orgs/verify'].includes(route);

  return (
    <Breadcrumb className="mt-2 flex w-full flex-row flex-nowrap overflow-x-auto lg:mt-0 lg:overflow-visible">
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

        {showBreadcrumbs && appSubdomain && (
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

            {isGraphQLPage && (
              <>
                <BreadcrumbSeparator>
                  <Slash
                    strokeWidth={3.5}
                    className="text-muted-foreground/50"
                  />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  <ProjectGraphQLPagesComboBox />
                </BreadcrumbItem>
              </>
            )}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
