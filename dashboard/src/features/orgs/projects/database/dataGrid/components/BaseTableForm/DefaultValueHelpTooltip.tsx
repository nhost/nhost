import { Info } from 'lucide-react';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

const TOOLTIP_DELAY = 500;

/**
 * Info tooltip shown next to the "Default Value" column header, explaining that
 * defaults are entered as verbatim SQL.
 */
export default function DefaultValueHelpTooltip() {
  return (
    <Tooltip delayDuration={TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Default value help"
          className="flex items-center text-muted-foreground hover:text-foreground"
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-2 font-normal">
        <p>Default values are entered as SQL:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Quote text and dates — <InlineCode>{"'active'"}</InlineCode>,{' '}
            <InlineCode>{"'2024-01-01'"}</InlineCode>
          </li>
          <li>
            Numbers and booleans as-is — <InlineCode>42</InlineCode>,{' '}
            <InlineCode>true</InlineCode>
          </li>
          <li>
            Functions directly — <InlineCode>now()</InlineCode>,{' '}
            <InlineCode>gen_random_uuid()</InlineCode>
          </li>
          <li>
            Typed literals — <InlineCode>interval '1 day'</InlineCode>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
