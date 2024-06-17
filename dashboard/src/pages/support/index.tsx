import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { DiscordIcon } from '@/components/ui/v2/icons/DiscordIcon';
import { FileTextIcon } from '@/components/ui/v2/icons/FileTextIcon';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { type ReactElement } from 'react';

function SupportPage() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Box
        sx={{ backgroundColor: 'background.default' }}
        className="flex flex-col items-center justify-center w-full h-64 gap-10 mb-10"
      >
        <div>
          <Text variant="h4">Nhost Support</Text>
          <Text variant="h2">How can we help?</Text>
        </div>

        <Button
          onClick={() => window.open('https://docs.nhost.io')}
          className="h-10 w-98"
          startIcon={<FileTextIcon className="self-center w-4 h-4" />}
        >
          Read our docs
        </Button>
      </Box>

      <Box className="flex flex-row items-center justify-center w-full gap-10">
        <div className="flex w-[900px] flex-col gap-10">
          <div className="flex flex-row w-full gap-10">
            <Box
              className="flex flex-col w-full h-full gap-12 px-4 py-3 rounded-lg shadow-sm place-content-between"
              sx={{ backgroundColor: 'grey.200' }}
            >
              <div className="flex flex-col gap-4">
                <GitHubIcon className="w-8 h-8" />
                <div className="grid grid-flow-row gap-1">
                  <Text variant="h3" className="!font-bold">
                    Issues & feature requests
                  </Text>
                  <Text className="!font-medium" color="secondary">
                    Found a bug? We&apos;d love to hear about it in our GitHub
                    issues.
                  </Text>
                </div>
              </div>
              <Link
                variant="body2"
                underline="hover"
                href="https://github.com/nhost/nhost/issues/new/choose"
                target="_blank"
                rel="dofollow"
                className="grid items-center justify-start grid-flow-col gap-1 font-medium"
              >
                Open new Issue / Feature request
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </Box>
            <Box
              className="flex flex-col w-full h-full gap-12 px-4 py-3 rounded-lg shadow-sm place-content-between"
              sx={{ backgroundColor: 'grey.200' }}
            >
              <div className="flex flex-col gap-4">
                <DiscordIcon className="w-8 h-8" />
                <div className="grid grid-flow-row gap-1">
                  <Text variant="h3" className="!font-bold">
                    Ask the Community
                  </Text>
                  <Text className="!font-medium" color="secondary">
                    Join our GitHub discussions or our Discord server to browse
                    for help and best practices.
                  </Text>
                </div>
              </div>
              <Link
                variant="body2"
                underline="hover"
                href="https://discord.com/invite/9V7Qb2U"
                target="_blank"
                rel="dofollow"
                className="grid items-center justify-start grid-flow-col gap-1 font-medium"
              >
                Join our Discord
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </Box>
          </div>

          <Box className="flex flex-row w-full h-full gap-4 p-6 border rounded-lg shadow-sm place-content-between">
            <div className="flex flex-1">
              <Text variant="h3" className="w-full">
                Can&apos;t find what you&apos;re looking for?
              </Text>
            </div>

            <div className="flex flex-col flex-1 gap-4">
              <Text variant="h4">Our Support Team is ready to help.</Text>
              <Text>
                Response time for support tickets will vary depending on plan
                type and severity of the issue.
              </Text>

              <Link
                variant="body2"
                underline="hover"
                href="/support/ticket"
                target="_blank"
                rel="dofollow"
                className="grid items-center justify-start grid-flow-col gap-1 font-medium"
              >
                Create ticket
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </Box>
        </div>
      </Box>
    </div>
  );
}

SupportPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout
      title="Help & Support | Nhost"
      contentContainerProps={{ className: 'flex w-full flex-col px-4' }}
    >
      {page}
    </AuthenticatedLayout>
  );
};

export default SupportPage;
