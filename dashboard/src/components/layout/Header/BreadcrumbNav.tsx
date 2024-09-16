import { Slash } from 'lucide-react';

import { Logo } from '@/components/presentational/Logo';
import { Badge } from '@/components/ui/v3/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/v3/breadcrumb';
import { cn } from '@/lib/utils';
import BreadCrumbComboBox from './BreadcrumbComboBox';

export default function BreadcrumbNav() {
  const orgs = [
    {
      name: "Hassan's org",
      slug: 'x2f9k7m1p3q8r',
      isFree: false,
      plan: 'Pro',
      projects: [
        { name: 'eu-central-1.celsia' },
        { name: 'joyent' },
        { name: 'react-apollo' },
      ],
    },
    {
      name: 'nhost-testing',
      slug: 'a3b7c9d1e5f2g',
      isFree: true,
      plan: 'Starter',
    },
    {
      name: 'uflip',
      slug: 'h4j2l6n8m0p5q',
      isFree: false,
      plan: 'Team',
    },
  ];

  const projects = [
    { name: 'eu-central-1.celsia', slug: 'x2f9k7m1p3q8r' },
    { name: 'joyent', slug: 'a3b7c9d1e5f2g' },
    { name: 'react-apollo', slug: 'h4j2l6n8m0p5q' },
  ];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <div className="h-7 w-7">
            <Logo className="mx-auto cursor-pointer" />
          </div>
        </BreadcrumbItem>

        <BreadcrumbSeparator>
          <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
        </BreadcrumbSeparator>

        <BreadcrumbItem>
          <BreadCrumbComboBox
            selectedValue={orgs[0].slug}
            options={orgs.map((org) => ({
              label: (
                <>
                  <span>{org.name}</span>
                  {org.plan && (
                    <Badge
                      variant={org.isFree ? 'outline' : 'default'}
                      className={cn(
                        org.isFree ? 'bg-muted' : '',
                        'hover:none ml-2 h-5 px-[6px] text-[10px]',
                      )}
                    >
                      {org.plan}
                    </Badge>
                  )}
                </>
              ),
              value: org.slug,
            }))}
          />
        </BreadcrumbItem>

        <BreadcrumbSeparator>
          <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
        </BreadcrumbSeparator>

        <BreadcrumbItem>
          <div className="flex flex-row items-center justify-center gap-2">
            <BreadCrumbComboBox
              selectedValue="projects"
              options={[
                { label: 'General', value: 'general' },
                { label: 'Projects', value: 'projects' },
                { label: 'Team', value: 'team' },
                { label: 'Billing', value: 'billing' },
              ]}
            />
          </div>
        </BreadcrumbItem>

        <BreadcrumbSeparator>
          <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
        </BreadcrumbSeparator>

        <BreadcrumbItem>
          <BreadCrumbComboBox
            selectedValue={projects[0].slug}
            options={projects.map((project) => ({
              label: project.name,
              value: project.slug,
            }))}
          />
        </BreadcrumbItem>

        <BreadcrumbSeparator>
          <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
        </BreadcrumbSeparator>

        <BreadcrumbItem>
          <BreadCrumbComboBox
            selectedValue="settings"
            options={[
              { label: 'Overview', value: 'overview' },
              { label: 'Database', value: 'database' },
              { label: 'GraphQL', value: 'graphql' },
              { label: 'Hasura', value: 'hasura' },
              { label: 'Authentication', value: 'auth' },
              { label: 'Storage', value: 'storage' },
              { label: 'Run', value: 'run' },
              { label: 'AI', value: 'ai' },
              { label: 'Deployments', value: 'deployments' },
              { label: 'Backups', value: 'backups' },
              { label: 'Logs', value: 'logs' },
              { label: 'Metrics', value: 'metrics' },
              { label: 'Settings', value: 'settings' },
            ]}
          />
        </BreadcrumbItem>

        <BreadcrumbSeparator>
          <Slash strokeWidth={3.5} className="text-muted-foreground/50" />
        </BreadcrumbSeparator>

        <BreadcrumbItem>
          <BreadcrumbItem>
            <BreadCrumbComboBox
              selectedValue="authentication"
              options={[
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
              }))}
            />
          </BreadcrumbItem>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
