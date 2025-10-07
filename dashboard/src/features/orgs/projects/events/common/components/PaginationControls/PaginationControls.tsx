import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';

export interface PaginationControlsProps {
  offset: number;
  limit: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onChangeLimit: (value: number) => void;
}

export default function PaginationControls({
  offset,
  limit,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onChangeLimit,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev}
          onClick={onPrev}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {offset} - {offset + limit}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <Select
          defaultValue={String(limit)}
          onValueChange={(value) => onChangeLimit(parseInt(value, 10))}
        >
          <SelectTrigger className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="75">75</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
