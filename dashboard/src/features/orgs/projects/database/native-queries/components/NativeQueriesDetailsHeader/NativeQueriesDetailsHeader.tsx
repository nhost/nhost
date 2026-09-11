import { MessageSquareText, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';

interface NativeQueriesDetailsHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  description?: string;
  onEdit: VoidFunction;
}

export default function NativeQueriesDetailsHeader({
  icon,
  title,
  subtitle,
  description,
  onEdit,
}: NativeQueriesDetailsHeaderProps) {
  return (
    <div className="border-b-1 px-6 pt-6 pb-4">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="mb-1 font-semibold text-foreground text-xl">
            {title}
          </h1>
          <span className="text-muted-foreground text-sm">{subtitle}</span>
          {description != null && description.length > 0 && (
            <div className="mt-3 flex max-w-prose items-start gap-2 text-muted-foreground text-sm">
              <MessageSquareText className="mt-0.5 size-4 shrink-0" />
              <TextWithTooltip
                text={description}
                maxLines={3}
                containerClassName="min-w-0 flex-1"
                className="break-words"
              />
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    </div>
  );
}
