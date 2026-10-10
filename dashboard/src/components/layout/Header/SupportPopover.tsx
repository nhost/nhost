import { SiDiscord as DiscordIcon } from '@icons-pack/react-simple-icons';
import { CircleHelpIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import SupportLinks from '@/components/layout/Header/SupportLinks';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Separator } from '@/components/ui/v3/separator';

const DISCORD_URL = 'https://discord.com/invite/9V7Qb2U';

export default function SupportPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="subtle" aria-label="Help and support">
          <CircleHelpIcon />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
        <div className="px-4 py-4">
          <h2 className="font-semibold text-sm">Help and support</h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Resources to keep you shipping.
          </p>
        </div>

        <Separator />

        <div className="grid gap-1 p-2">
          <SupportLinks />
        </div>

        <div className="px-3 pb-3">
          <Link
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-emboss-primary-gradient-only flex items-center gap-3 rounded-md px-3 py-2"
          >
            <DiscordIcon className="size-7 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-sm">
                Join us on Discord
              </span>
              <span className="block text-xs opacity-90">
                Our community answers questions in minutes.
              </span>
            </span>
            <ExternalLinkIcon className="size-4 shrink-0" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
