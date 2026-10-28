import { ArrowUpRight, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/v3/hover-card';

export interface SettingsDocsLinkProps {
  /**
   * Documentation URL.
   */
  href: string;
  /**
   * Only the subject of the docs, for example "Client URL". The component
   * adds "Learn more about" in front of it, so don't include it here.
   */
  topic: string;
}

/**
 * The help icon next to a settings card title. Clicking it opens the docs in
 * a new tab. Hovering shows "Learn more about <topic>" with the topic as a
 * link, and the card stays open while the pointer moves onto it.
 */
export function SettingsDocsLink({ href, topic }: SettingsDocsLinkProps) {
  return (
    <HoverCard openDelay={200} closeDelay={150}>
      <HoverCardTrigger asChild>
        <Button variant="subtle" size="icon-xs" asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Learn more about ${topic}`}
          >
            <CircleHelp className="size-4" />
          </a>
        </Button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        className="w-auto max-w-xs px-3 py-2 text-muted-foreground text-sm"
      >
        Learn more about{' '}
        {/* Keyboard users reach the docs through the icon itself. */}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        >
          {topic}
          <ArrowUpRight className="size-4 shrink-0" />
        </a>
      </HoverCardContent>
    </HoverCard>
  );
}
