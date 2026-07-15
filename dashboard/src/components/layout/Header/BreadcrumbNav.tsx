import { Slash } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/v3/breadcrumb';
import { cn } from '@/lib/utils';
import OrgPagesComboBox from './OrgPagesComboBox';
import OrgsComboBox from './OrgsComboBox';
import ProjectAuthPagesComboBox from './ProjectAuthPagesComboBox';
import ProjectDatabasePagesComboBox from './ProjectDatabasePagesComboBox';
import ProjectEventsPagesComboBox from './ProjectEventsPagesComboBox';
import ProjectGraphQLPagesComboBox from './ProjectGraphQLPagesComboBox';
import ProjectPagesComboBox from './ProjectPagesComboBox';
import ProjectSettingsPagesComboBox from './ProjectSettingsPagesComboBox';
import ProjectsComboBox from './ProjectsComboBox';

export default function BreadcrumbNav() {
  const breadcrumbRef = useRef<HTMLElement>(null);
  const [hasHorizontalScrollbar, setHasHorizontalScrollbar] = useState(false);
  const { query, asPath, route } = useRouter();

  const { appSubdomain } = query;

  // Extract path segments from the URL
  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);

  // Identify project and settings pages based on the URL pattern
  const projectPage = pathSegments[3] || null;
  const isSettingsPage = pathSegments[5] === 'settings';
  const isGraphQLPage = pathSegments[5] === 'graphql';
  const isEventsPage = pathSegments[5] === 'events';
  const isAuthPage = pathSegments[5] === 'auth';
  const isDatabasePage = pathSegments[5] === 'database';

  const showBreadcrumbs = !['/', '/orgs/verify'].includes(route);

  useEffect(() => {
    const breadcrumb = breadcrumbRef.current;

    if (!breadcrumb) {
      return undefined;
    }

    const updateHasHorizontalScrollbar = () => {
      setHasHorizontalScrollbar(
        breadcrumb.scrollWidth > breadcrumb.clientWidth,
      );
    };

    updateHasHorizontalScrollbar();

    const resizeObserver = new ResizeObserver(updateHasHorizontalScrollbar);
    resizeObserver.observe(breadcrumb);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <Breadcrumb
      ref={breadcrumbRef}
      className={cn(
        'mt-2 flex w-full min-w-0 flex-row flex-nowrap items-center overflow-x-auto lg:mt-0',
        hasHorizontalScrollbar && 'lg:pt-2',
      )}
    >
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

            {isEventsPage && (
              <>
                <BreadcrumbSeparator>
                  <Slash
                    strokeWidth={3.5}
                    className="text-muted-foreground/50"
                  />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  <ProjectEventsPagesComboBox />
                </BreadcrumbItem>
              </>
            )}

            {isAuthPage && (
              <>
                <BreadcrumbSeparator>
                  <Slash
                    strokeWidth={3.5}
                    className="text-muted-foreground/50"
                  />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  <ProjectAuthPagesComboBox />
                </BreadcrumbItem>
              </>
            )}

            {isDatabasePage && (
              <>
                <BreadcrumbSeparator>
                  <Slash
                    strokeWidth={3.5}
                    className="text-muted-foreground/50"
                  />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  <ProjectDatabasePagesComboBox />
                </BreadcrumbItem>
              </>
            )}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
