import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

export interface SettingsDocsLinkProps {
  /**
   * Documentation URL.
   */
  href: string;
  /**
   * What the docs explain, read after "Learn more about" in the tooltip and
   * the accessible name.
   */
  title: string;
}

/**
 * The help icon next to a settings card title: opens the docs in a new tab,
 * with "Learn more about …" on hover and focus.
 */
export function SettingsDocsLink({ href, title }: SettingsDocsLinkProps) {
  const label = `Learn more about ${title}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="subtle" size="icon-xs" asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
          >
            <CircleHelp className="size-4" />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
