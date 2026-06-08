import {
  SiGraphql as GraphQLIcon,
  SiHasura as HasuraIcon,
  SiDocker as ServicesIcon,
} from '@icons-pack/react-simple-icons';
import {
  Sparkles as AIIcon,
  CloudIcon,
  Code,
  CogIcon,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  RocketIcon,
  HardDrive as StorageIcon,
  UserIcon,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export default function ProjectPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const isPlatform = useIsPlatform();

  const isSettingsDisabled = useSettingsDisabled();

  const projectPages = useMemo(
    () => [
      {
        label: 'Overview',
        value: 'overview',
        icon: <HomeIcon className="h-4 w-4" />,
        slug: '',
        disabled: false,
      },
      {
        label: 'Database',
        value: 'database',
        icon: <DatabaseIcon className="h-4 w-4" />,
        slug: 'database/browser/default',
        disabled: false,
      },
      {
        label: 'GraphQL',
        value: 'graphql',
        icon: <GraphQLIcon className="h-4 w-4" />,
        slug: 'graphql',
        disabled: false,
      },
      {
        label: 'Events',
        value: 'events',
        icon: <Zap className="h-4 w-4" />,
        slug: 'events/event-triggers',
        disabled: false,
      },
      {
        label: 'Hasura',
        value: 'hasura',
        icon: <HasuraIcon className="h-4 w-4" />,
        slug: 'hasura',
        disabled: false,
      },
      {
        label: 'Auth',
        value: 'auth',
        icon: <UserIcon className="h-4 w-4" />,
        slug: 'auth/users',
        disabled: false,
      },
      {
        label: 'Storage',
        value: 'storage',
        icon: <StorageIcon className="h-4 w-4" />,
        slug: 'storage',
        disabled: false,
      },
      {
        label: 'Functions',
        value: 'functions',
        icon: <Code className="h-4 w-4" />,
        slug: 'functions',
        disabled: false,
      },
      {
        label: 'Run',
        value: 'run',
        icon: <ServicesIcon className="h-4 w-4" />,
        slug: 'run',
        disabled: false,
      },
      {
        label: 'AI',
        value: 'ai',
        icon: <AIIcon className="h-4 w-4" />,
        slug: 'ai/auto-embeddings',
        disabled: false,
      },
      {
        label: 'Deployments',
        value: 'deployments',
        icon: <RocketIcon className="h-4 w-4" />,
        slug: 'deployments',
        disabled: !isPlatform,
      },
      {
        label: 'Backups',
        value: 'backups',
        icon: <CloudIcon className="h-4 w-4" />,
        slug: 'backups',
        disabled: !isPlatform,
      },
      {
        label: 'Logs',
        value: 'logs',
        icon: <FileTextIcon className="h-4 w-4" />,
        slug: 'logs',
        disabled: false,
      },
      {
        label: 'Metrics',
        value: 'metrics',
        icon: <GaugeIcon className="h-4 w-4" />,
        slug: 'metrics',
        disabled: !isPlatform,
      },
      {
        label: 'Settings',
        value: 'settings',
        icon: <CogIcon className="h-4 w-4" />,
        slug: 'settings',
        disabled: isSettingsDisabled,
      },
    ],
    [isPlatform, isSettingsDisabled],
  );

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const projectPageFromUrl = appSubdomain
    ? pathSegments[5] || 'overview'
    : null;

  const selectedProjectPageFromUrl = projectPages.find(
    (item) => item.value === projectPageFromUrl,
  );

  const options = projectPages.map((app) => ({
    value: app.slug,
    label: app.label,
    disabled: app.disabled,
    render: (
      <div className="flex flex-row items-center gap-2">
        {app.icon}
        <span className="max-w-52 truncate">{app.label}</span>
      </div>
    ),
  }));

  const triggerLabel = selectedProjectPageFromUrl ? (
    <div className="flex flex-row items-center justify-center gap-2">
      {selectedProjectPageFromUrl.icon}
      {selectedProjectPageFromUrl.label}
    </div>
  ) : null;

  const handlePageSelect = (slug: string) => {
    push(`/orgs/${orgSlug}/projects/${appSubdomain}/${slug}`);
  };

  return (
    <Combobox
      options={options}
      value={selectedProjectPageFromUrl?.slug ?? null}
      triggerLabel={triggerLabel}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
      onChange={handlePageSelect}
    />
  );
}
