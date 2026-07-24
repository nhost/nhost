import { CopyIcon } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';

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
          <InputGroupButton
            aria-label="Copy Redirect URL"
            onClick={(e) => {
              e.stopPropagation();
              copy(value, 'Redirect URL');
            }}
          >
            <CopyIcon className="h-4 w-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
