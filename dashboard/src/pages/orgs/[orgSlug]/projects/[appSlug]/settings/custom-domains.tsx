import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Box } from '@/components/ui/v2/Box';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';
import { AuthDomain } from '@/features/orgs/projects/custom-domains/settings/components/AuthDomain';
import { DatabaseDomain } from '@/features/orgs/projects/custom-domains/settings/components/DatabaseDomain';
import { HasuraDomain } from '@/features/orgs/projects/custom-domains/settings/components/HasuraDomain';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { ServerlessFunctionsDomain } from '@/features/orgs/projects/custom-domains/settings/components/ServerlessFunctionsDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { type ReactElement } from 'react';

export default function CustomDomains() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        {/* <UpgradeToProBanner
          title="Upgrade to Nhost Pro to unlock custom domains"
          description=""
        /> */}
        <UpgradeNotification message="Unlock Custom Domains by upgrading your organization to the Pro plan." />
      </Container>
    );
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <Box className="flex flex-row items-center gap-4 p-4 overflow-hidden rounded-lg border-1">
        <div className="flex flex-col space-y-2">
          <Text className="text-lg font-semibold">Custom Domains</Text>

          <Text color="secondary">
            Add a custom domain to Auth, Hasura, PostgreSQL, and your Run
            services for only a $10 flat fee 🚀 <br /> Learn more about
            <Link
              href="https://docs.nhost.io/platform/custom-domains"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              className="ml-1 font-medium"
            >
              Custom Domains
              <ArrowSquareOutIcon className="w-4 h-4 ml-1" />
            </Link>
          </Text>
        </div>
      </Box>

      <AuthDomain />
      <HasuraDomain />
      <DatabaseDomain />

      <ServerlessFunctionsDomain />
      <RunServiceDomains />
    </Container>
  );
}

CustomDomains.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
