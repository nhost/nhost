import { GlobeIcon, LockIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import {
  generateAppServiceUrl,
  type NhostService,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetResourcesQuery,
  useGetServerlessFunctionsSettingsQuery,
} from '@/generated/graphql';

// Path each service answers on when it has a custom domain (see the custom
// domains docs). Storage can't have one, so it always uses the default URL.
const customDomainPaths: Partial<Record<NhostService, string>> = {
  graphql: '/v1/graphql',
  auth: '/v1',
  functions: '/v1',
};

const endpoints: { service: NhostService; label: string }[] = [
  { service: 'graphql', label: 'GraphQL' },
  { service: 'auth', label: 'Auth' },
  { service: 'storage', label: 'Storage' },
  { service: 'functions', label: 'Functions' },
];

function ConnectRow({
  label,
  children,
  copyValue,
}: {
  label: string;
  children: ReactNode;
  copyValue?: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b px-4 py-1.5 last:border-b-0">
      <span className="w-20 shrink-0 text-muted-foreground text-xs">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{children}</span>
      {copyValue && (
        <CopyToClipboardButton textToCopy={copyValue} title={label} />
      )}
    </div>
  );
}

export default function OverviewConnect() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  const { data: resourcesData } = useGetResourcesQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
  });
  const { data: functionsData } = useGetServerlessFunctionsSettingsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
  });

  const customDomains: Partial<Record<NhostService, string>> = {
    graphql:
      resourcesData?.config?.hasura?.resources?.networking?.ingresses?.[0]
        ?.fqdn?.[0],
    auth: resourcesData?.config?.auth?.resources?.networking?.ingresses?.[0]
      ?.fqdn?.[0],
    functions:
      functionsData?.config?.functions?.resources?.networking?.ingresses?.[0]
        ?.fqdn?.[0],
  };
  const hasCustomDomain = Object.values(customDomains).some(Boolean);

  if (!project) {
    return null;
  }

  const { region, subdomain } = project;
  const hasRegionDetails = !!(region?.countryCode && region?.city);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Connect</h2>

      <div className="overflow-hidden rounded-lg border shadow-sm">
        <ConnectRow label="Subdomain" copyValue={subdomain}>
          <span className="font-mono">{subdomain}</span>
        </ConnectRow>

        {region?.name && (
          <ConnectRow label="Region" copyValue={region.name}>
            {hasRegionDetails ? (
              <span className="flex items-center gap-1.5">
                <Image
                  src={`/assets/flags/${region.countryCode}.svg`}
                  alt=""
                  width={16}
                  height={12}
                />
                {region.city}
                <span className="text-muted-foreground">({region.name})</span>
              </span>
            ) : (
              region.name
            )}
          </ConnectRow>
        )}

        {hasCustomDomain && (
          <div className="flex items-center gap-2 border-b px-4 py-2.5 text-muted-foreground text-xs">
            <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Showing your custom domains</span>
          </div>
        )}

        {endpoints.map(({ service, label }) => {
          const customDomain = customDomains[service];
          const url = customDomain
            ? `https://${customDomain}${customDomainPaths[service] ?? ''}`
            : generateAppServiceUrl(subdomain, region, service);

          return (
            <ConnectRow key={service} label={label} copyValue={url}>
              <span className="font-mono" title={url}>
                {url}
              </span>
            </ConnectRow>
          );
        })}

        <div className="flex items-center gap-2 bg-muted/50 px-4 py-2.5 text-muted-foreground text-xs">
          <LockIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            The admin secret and keys live in{' '}
            <Link
              href={`/orgs/${org?.slug}/projects/${subdomain}/settings?tab=environment-variables`}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Settings › Environment variables
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}
