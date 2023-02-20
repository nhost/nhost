import { Resources } from '@/components/home';
import GithubIcon from '@/components/icons/GithubIcon';
import { WorkspaceSection } from '@/components/workspace/WorkspaceSection';
import Button from '@/ui/v2/Button';
import Image from 'next/image';
import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="grid grid-flow-row gap-8 mt-2 ml-10 w-full md:grid md:w-workspaceSidebar content-start">
      <WorkspaceSection />
      <Resources />

      <div className="grid grid-flow-row gap-2">
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
            startIcon={<GithubIcon />}
          >
            Star us on GitHub
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
              src="/assets/brands/discord.svg"
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
