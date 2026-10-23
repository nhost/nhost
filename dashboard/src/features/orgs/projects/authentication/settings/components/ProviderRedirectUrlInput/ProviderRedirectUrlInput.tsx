import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import { cn } from '@/lib/utils';

export interface ProviderRedirectUrlInputProps {
  id: string;
  value: string;
  className?: string;
}

export default function ProviderRedirectUrlInput({
  id,
  value,
  className,
}: ProviderRedirectUrlInputProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>Redirect URL</Label>
      <InputGroup className="bg-transparent dark:bg-transparent">
        <InputGroupInput id={id} value={value} disabled readOnly />
        <InputGroupAddon align="inline-end">
          <CopyToClipboardButton
            textToCopy={value}
            title="Redirect URL"
            tooltip="Copy URL"
          />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
