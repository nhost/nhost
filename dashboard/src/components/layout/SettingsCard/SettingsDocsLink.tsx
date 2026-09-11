import { CircleHelp } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

export interface SettingsDocsLinkProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Documentation URL.
   */
  href: string;
  /**
   * Tooltip label describing what the link is about, e.g. "how to sign in
   * users with email and password".
   */
  title: string;
}

function capitalizeFirstLetter(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const SettingsDocsLink = React.forwardRef<
  HTMLDivElement,
  SettingsDocsLinkProps
>(({ className, href, title, ...props }, ref) => {
  const label = capitalizeFirstLetter(title);

  return (
    <div
      ref={ref}
      className={cn('flex sm:mr-auto sm:self-center', className)}
      {...props}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="group h-8 w-8 hover:bg-transparent"
          >
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
              <CircleHelp className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </div>
  );
});
SettingsDocsLink.displayName = 'SettingsDocsLink';

export { SettingsDocsLink };
