import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { ArrowRightIcon, FileTextIcon, UsersRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/presentational/Logo';
import { Button } from '@/components/ui/v3/button';

function SupportPage() {
  return (
    <div className="box h-full overflow-auto pb-4">
      <div className="flex w-full justify-start border-b-1 px-4 py-3">
        <Link href="https://app.nhost.io" rel="noopener noreferrer">
          <Logo className="w-6" />
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center">
        <div className="mb-10 flex h-64 w-full flex-col items-center justify-center gap-10 border-b-1 bg-background-default px-4">
          <div>
            <h4 className="font-medium text-base">Nhost Support</h4>
            <h2 className="font-medium text-2xl">How can we help?</h2>
          </div>
          <Button
            onClick={() => window.open('https://docs.nhost.io')}
            className="h-10 w-full xs+:w-98"
          >
            <FileTextIcon className="mr-2 h-4 w-4 self-center" />
            Read our docs
          </Button>
        </div>

        <div className="flex w-full flex-row items-center justify-center gap-10">
          <div className="flex w-[900px] flex-col gap-10 p-4">
            <div className="flex w-full flex-col gap-10 md:flex-row">
              <div className="flex h-full w-full flex-col place-content-between gap-12 rounded-lg bg-muted px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-4">
                  <GitHubIcon className="h-8 w-8" />
                  <div className="grid grid-flow-row gap-1">
                    <h3 className="!font-bold text-lg">
                      Issues & feature requests
                    </h3>
                    <p className="!font-medium text-muted-foreground text-sm">
                      Found a bug? We&apos;d love to hear about it in our GitHub
                      issues.
                    </p>
                  </div>
                </div>
                <Link
                  href="https://github.com/nhost/nhost/issues/new/choose"
                  target="_blank"
                  rel="dofollow"
                  className="grid grid-flow-col items-center justify-start gap-1 font-medium text-primary text-sm hover:underline"
                >
                  Open new Issue / Feature request
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex h-full w-full flex-col place-content-between gap-12 rounded-lg bg-muted px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-4">
                  <UsersRoundIcon className="h-8 w-8" />
                  <div className="grid grid-flow-row gap-1">
                    <h3 className="!font-bold text-lg">Ask the Community</h3>
                    <p className="!font-medium text-muted-foreground text-sm">
                      Join our Discord server to browse for help and best
                      practices.
                    </p>
                  </div>
                </div>
                <Link
                  href="https://discord.com/invite/9V7Qb2U"
                  target="_blank"
                  rel="dofollow"
                  className="grid grid-flow-col items-center justify-start gap-1 font-medium text-primary text-sm hover:underline"
                >
                  Join our Discord
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="flex h-full w-full xs+:flex-row flex-col place-content-between gap-4 rounded-lg border p-4 shadow-sm">
              <div className="flex flex-1">
                <h3 className="w-full font-medium text-lg">
                  Can&apos;t find what you&apos;re looking for?
                </h3>
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <h4 className="font-medium text-base">
                  Our Support Team is ready to help.
                </h4>
                <p className="text-sm">
                  Response time for support tickets will vary depending on plan
                  type and severity of the issue.
                </p>
                <Link
                  href="/support/ticket"
                  target="_blank"
                  rel="dofollow"
                  className="grid grid-flow-col items-center justify-start gap-1 font-medium text-primary text-sm hover:underline"
                >
                  Create ticket
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupportPage;
