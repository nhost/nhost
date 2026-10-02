import { Badge } from '@/components/ui/v3/badge';

export interface LastUsedBadgeProps {
  id?: string;
}

export default function LastUsedBadge({ id }: LastUsedBadgeProps) {
  return (
    <Badge
      id={id}
      className="pointer-events-none absolute -top-3.5 right-4 z-10 select-none rounded-full border border-blue-500/40 bg-[#0c2d6b] px-2.5 py-0.5 font-bold text-[10px] text-blue-200 uppercase tracking-wider shadow-sm"
    >
      LAST USED
    </Badge>
  );
}
