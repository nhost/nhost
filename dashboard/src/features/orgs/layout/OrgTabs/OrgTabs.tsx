import Link from 'next/link';
import { useRouter } from 'next/router';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';

const ORG_TAB_ROUTES = [
  '/orgs/[orgSlug]/projects',
  '/orgs/[orgSlug]/members',
  '/orgs/[orgSlug]/billing',
  '/orgs/[orgSlug]/settings',
] as const;

type OrgTabRoute = (typeof ORG_TAB_ROUTES)[number];

const TAB_DEFINITIONS: {
  value: OrgTabRoute;
  label: string;
  segment: string;
}[] = [
  {
    value: '/orgs/[orgSlug]/projects',
    label: 'Projects',
    segment: 'projects',
  },
  { value: '/orgs/[orgSlug]/members', label: 'Members', segment: 'members' },
  { value: '/orgs/[orgSlug]/billing', label: 'Billing', segment: 'billing' },
  {
    value: '/orgs/[orgSlug]/settings',
    label: 'Settings',
    segment: 'settings',
  },
];

export default function OrgTabs() {
  const { pathname, query } = useRouter();
  const orgSlug = query.orgSlug as string | undefined;

  if (!orgSlug) {
    return null;
  }

  if (!ORG_TAB_ROUTES.includes(pathname as OrgTabRoute)) {
    return null;
  }

  return (
    <div className="flex border-b bg-background px-4 py-2">
      <Tabs value={pathname}>
        <TabsList>
          {TAB_DEFINITIONS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link href={`/orgs/${orgSlug}/${tab.segment}`}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
