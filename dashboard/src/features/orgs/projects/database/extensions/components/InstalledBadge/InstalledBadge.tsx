import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/v3/badge';

export default function InstalledBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 font-medium text-muted-foreground"
    >
      <Check className="size-3" aria-hidden />
      Installed
    </Badge>
  );
}
