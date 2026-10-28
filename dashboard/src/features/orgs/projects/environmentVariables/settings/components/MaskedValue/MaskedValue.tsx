import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

export interface MaskedValueProps {
  /**
   * The value, hidden behind dots until the eye button is clicked. It can be
   * copied without showing it.
   */
  value?: string | null;
  /**
   * Name of the value, used in the eye button's label.
   */
  name: string;
}

export default function MaskedValue({ value, name }: MaskedValueProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 break-all text-muted-foreground">
        {show ? (
          <InlineCode className="!text-sm whitespace-normal font-medium">
            {value}
          </InlineCode>
        ) : (
          '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
        )}
      </p>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="subtle"
            className="shrink-0"
            aria-label={show ? `Hide ${name}` : `Show ${name}`}
            onClick={() => setShow((current) => !current)}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {show ? `Hide ${name}` : `Show ${name}`}
        </TooltipContent>
      </Tooltip>

      {/* Shows on row hover (the row is the `group`) or keyboard focus. */}
      <CopyToClipboardButton
        className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        textToCopy={value}
        title={name}
      />
    </div>
  );
}
