import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { CommunityIcon } from '@/components/ui/v2/icons/CommunityIcon';
import { FileTextIcon } from '@/components/ui/v2/icons/FileTextIcon';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';

function SupportPage() {
  return (
    <Box className="h-screen overflow-auto pb-4">
      <Box className="flex w-full justify-start border-b-1 px-4 py-3">
        <Logo className="w-6 cursor-pointer" />
      </Box>

      <div className="flex flex-col items-center justify-center">
        <Box
          sx={{ backgroundColor: 'background.default' }}
          className="mb-10 flex h-64 w-full flex-col items-center justify-center gap-10 border-b-1 px-4"
        >
          <div>
            <Text variant="h4">Nhost Support</Text>
            <Text variant="h2">How can we help?</Text>
          </div>
          <Button
            onClick={() => window.open('https://docs.nhost.io')}
            className="h-10 w-full xs+:w-98"
            startIcon={<FileTextIcon className="h-4 w-4 self-center" />}
          >
            Read our docs
          </Button>
        </Box>

        <Box className="flex w-full flex-row items-center justify-center gap-10">
          <div className="flex w-[900px] flex-col gap-10 p-4">
            <div className="flex w-full flex-col gap-10 md:flex-row">
              <Box
                className="flex h-full w-full flex-col place-content-between gap-12 rounded-lg px-4 py-3 shadow-sm"
                sx={{ backgroundColor: 'grey.200' }}
              >
                <div className="flex flex-col gap-4">
                  <GitHubIcon className="h-8 w-8" />
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
                  className="grid grid-flow-col items-center justify-start gap-1 font-medium"
                >
                  Open new Issue / Feature request
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </Box>
              <Box
                className="flex h-full w-full flex-col place-content-between gap-12 rounded-lg px-4 py-3 shadow-sm"
                sx={{ backgroundColor: 'grey.200' }}
              >
                <div className="flex flex-col gap-4">
                  <CommunityIcon className="h-8 w-8" />
                  <div className="grid grid-flow-row gap-1">
                    <Text variant="h3" className="!font-bold">
                      Ask the Community
                    </Text>
                    <Text className="!font-medium" color="secondary">
                      Join our Discord server to browse for help and best
                      practices.
                    </Text>
                  </div>
                </div>
                <Link
                  variant="body2"
                  underline="hover"
                  href="https://discord.com/invite/9V7Qb2U"
                  target="_blank"
                  rel="dofollow"
                  className="grid grid-flow-col items-center justify-start gap-1 font-medium"
                >
                  Join our Discord
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </Box>
            </div>
            <Box className="flex h-full w-full flex-col place-content-between gap-4 rounded-lg border p-4 shadow-sm xs+:flex-row">
              <div className="flex flex-1">
                <Text variant="h3" className="w-full">
                  Can&apos;t find what you&apos;re looking for?
                </Text>
              </div>
              <div className="flex flex-1 flex-col gap-4">
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
                  className="grid grid-flow-col items-center justify-start gap-1 font-medium"
                >
                  Create ticket
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </Box>
          </div>
        </Box>
      </div>
    </Box>
  );
}

export default SupportPage;
