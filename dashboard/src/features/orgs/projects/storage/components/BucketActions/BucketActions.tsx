import { Ellipsis, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';

interface BucketActionsProps {
  onEdit: () => void;
}

export default function BucketActions({ onEdit }: BucketActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 shrink-0 border-none bg-transparent px-0 opacity-0 hover:bg-transparent group-hover:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.preventDefault()}
        >
          <Ellipsis className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-44 p-0">
        <DropdownMenuItem
          className="flex h-9 cursor-pointer items-center gap-2 rounded-none text-sm+"
          onClick={onEdit}
        >
          <SquarePen className="h-4 w-4" />
          <span>Edit Bucket</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
