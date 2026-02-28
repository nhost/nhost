import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/v3/badge';

export default function MetadataConsistentStatus() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-medium text-foreground text-lg">
            Metadata Status
          </h3>
          <p className="text-muted-foreground">All metadata is consistent</p>
        </div>
      </div>
      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
        Consistent
      </Badge>
    </div>
  );
}
