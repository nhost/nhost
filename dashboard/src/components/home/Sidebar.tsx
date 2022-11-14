import { Resources } from '@/components/home';
import { WorkspaceSection } from '@/components/workspace/WorkspaceSection';
import Button from '@/ui/v2/Button';
import Image from 'next/image';
import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="mt-2 ml-10 flex w-full flex-col md:block md:w-workspaceSidebar">
      <WorkspaceSection />
      <Resources />

      <div className="mt-8 grid grid-flow-row gap-2">
        <Link
          href="https://github.com/nhost/nhost"
          passHref
          target="_blank"
          rel="noreferrer noopener"
        >
          <Button
            className="grid grid-flow-col gap-1"
            variant="outlined"
            color="secondary"
            aria-labelledby="github-button-label"
          >
            <Image
              src="/logos/Github.svg"
              alt="GitHub Logo"
              width={24}
              height={24}
            />

            <span id="github-button-label">Star us on GitHub</span>
          </Button>
        </Link>

        <Link
          href="https://discord.com/invite/9V7Qb2U"
          passHref
          target="_blank"
          rel="noreferrer noopener"
        >
          <Button
            className="grid grid-flow-col gap-1"
            variant="outlined"
            color="secondary"
            aria-labelledby="discord-button-label"
          >
            <Image
              src="/logos/Discord.svg"
              alt="Discord Logo"
              width={24}
              height={24}
            />

            <span id="discord-button-label">Join Discord</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
