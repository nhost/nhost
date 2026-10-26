import { Badge } from '@/components/ui/v3/badge';

export default function LiveBadge() {
  return (
    <Badge
      variant="outline"
      className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
    >
      Live
    </Badge>
  );
}
