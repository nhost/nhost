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

import { Logo } from '@/components/presentational/Logo';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { GraphQLIcon } from '@/components/ui/v2/icons/GraphQLIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/v3/breadcrumb';
import NavComboBox from './NavComboBox';
import OrgsComboBox from './OrgsComboBox';
import ProjectsComboBox from './ProjectsComboBox';
import { useRouter } from 'next/router'

const projectPagesOptions = [
  {
    label: 'Overview',
    value: 'overview',
    icon: <HomeIcon className="w-4 h-4" />,
  },
  {
    label: 'Database',
    value: 'database',
    icon: <DatabaseIcon className="w-4 h-4" />,
  },
  {
    label: 'GraphQL',
    value: 'graphql',
    icon: <GraphQLIcon className="w-4 h-4" />,
  },
  {
    label: 'Hasura',
    value: 'hasura',
    icon: <HasuraIcon className="w-4 h-4" />,
  },
  { label: 'Auth', value: 'auth', icon: <UserIcon className="w-4 h-4" /> },
  {
    label: 'Storage',
    value: 'storage',
    icon: <StorageIcon className="w-4 h-4" />,
  },
  { label: 'Run', value: 'run', icon: <ServicesIcon className="w-4 h-4" /> },
  { label: 'AI', value: 'ai', icon: <AIIcon className="w-4 h-4" /> },
  {
    label: 'Deployments',
    value: 'deployments',
    icon: <RocketIcon className="w-4 h-4" />,
  },
  {
    label: 'Backups',
    value: 'backups',
    icon: <CloudIcon className="w-4 h-4" />,
  },
  { label: 'Logs', value: 'logs', icon: <FileTextIcon className="w-4 h-4" /> },
  {
    label: 'Metrics',
    value: 'metrics',
    icon: <GaugeIcon className="w-4 h-4" />,
  },
  {
    label: 'Settings',
    value: 'settings',
    icon: <CogIcon className="w-4 h-4" />,
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

  const { route } = useRouter()
  const showNavigationBreadCrumbs = route !== '/orgs/verify'
  
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <div className="h-7 w-7">
            <Logo className="mx-auto cursor-pointer" />
          </div>
        </BreadcrumbItem>

        {
          showNavigationBreadCrumbs && (
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

        <BreadcrumbItem>
          <NavComboBox value={orgPages[0]} options={orgPages} />
        </BreadcrumbItem>

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
          )
        }
        </BreadcrumbList>
    </Breadcrumb>
  );
}
