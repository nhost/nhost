import {
  CloudIcon,
  CogIcon,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  RocketIcon,
  Slash,
  UserIcon,
} from 'lucide-react';
import { useMemo } from 'react';

import { Logo } from '@/components/presentational/Logo';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/v3/breadcrumb';
import { useRouter } from 'next/router';
import NavComboBox from './NavComboBox';
import OrgsComboBox from './OrgsComboBox';
import ProjectPagesComboBox from './ProjectPagesComboBox';
import ProjectsComboBox from './ProjectsComboBox';

const projectPagesOptions = [
  {
    label: 'Overview',
    value: 'overview',
    icon: <HomeIcon className="h-4 w-4" />,
  },
  {
    label: 'Database',
    value: 'database',
    icon: <DatabaseIcon className="h-4 w-4" />,
  },
  {
    label: 'GraphQL',
    value: 'graphql',
    icon: <GraphQLIcon className="h-4 w-4" />,
  },
  {
    label: 'Hasura',
    value: 'hasura',
    icon: <HasuraIcon className="h-4 w-4" />,
  },
  { label: 'Auth', value: 'auth', icon: <UserIcon className="h-4 w-4" /> },
  {
    label: 'Storage',
    value: 'storage',
    icon: <StorageIcon className="h-4 w-4" />,
  },
  { label: 'Run', value: 'run', icon: <ServicesIcon className="h-4 w-4" /> },
  { label: 'AI', value: 'ai', icon: <AIIcon className="h-4 w-4" /> },
  {
    label: 'Deployments',
    value: 'deployments',
    icon: <RocketIcon className="h-4 w-4" />,
  },
  {
    label: 'Backups',
    value: 'backups',
    icon: <CloudIcon className="h-4 w-4" />,
  },
  { label: 'Logs', value: 'logs', icon: <FileTextIcon className="h-4 w-4" /> },
  {
    label: 'Metrics',
    value: 'metrics',
    icon: <GaugeIcon className="h-4 w-4" />,
  },
  {
    label: 'Settings',
    value: 'settings',
    icon: <CogIcon className="h-4 w-4" />,
  },
];

const projectSettingsOptions = [
  'General',
  'Compute Resources',
  'Database',
  'Hasura',
  'Authentication',
  'Sign-In methods',
  'Roles and Permissions',
  'SMTP',
  'Serverless Functions',
  'Git',
  'Environment Variables',
  'Secrets',
  'Custom Domains',
  'Rate Limiting',
  'AI',
].map((item) => ({
  label: item,
  value: item.toLowerCase().replace(' ', '-'),
}));

const orgPages = [
  { label: 'Settings', value: 'settings' },
  { label: 'Projects', value: 'projects' },
  { label: 'Members', value: 'members' },
  { label: 'Billing', value: 'billing' },
];

export default function BreadcrumbNav() {
  const router = useRouter();

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
              <NavComboBox
                value={projectPagesOptions[0]}
                options={projectPagesOptions}
              />
            </BreadcrumbItem>

            <BreadcrumbSeparator>
              <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
            </BreadcrumbSeparator>

            <BreadcrumbItem>
              <NavComboBox
                value={projectSettingsOptions[0]}
                options={projectSettingsOptions}
              />
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
