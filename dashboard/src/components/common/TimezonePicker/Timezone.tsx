import { CommandItem } from '@/components/ui/v3/command';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { TimeZone } from 'timezones-list';

interface Props extends TimeZone {
  onSelect: () => void;
  selected?: boolean;
}

function Timezone({ label, utc, tzCode, onSelect, selected }: Props) {
  const timeZoneLabel = `${label} (UTC${utc})`;
  return (
    <CommandItem value={label} key={tzCode} onSelect={onSelect}>
      {timeZoneLabel}
      <Check
        className={cn('ml-auto', selected ? 'opacity-100' : 'opacity-0')}
      />
    </CommandItem>
  );
}

export default Timezone;
