import { Check, ChevronDown } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import ProjectColorDot from '@/features/project-colors/components/ProjectColorDot';
import {
  PROJECT_COLORS,
  type ProjectColor,
} from '@/features/project-colors/lib/palette';
import { cn } from '@/lib/utils';

export interface ProjectColorPickerProps {
  projectName: string;
  color?: ProjectColor;
  /** The project name that already uses a color, if another project does. */
  getOwnerName: (color: ProjectColor) => string | undefined;
  onPick: (color: ProjectColor) => void;
}

/**
 * The color button of one project row. Opens a grid of every color, a light
 * and a dark tone per hue. A color already used by another project can still
 * be picked: it asks first, then the two projects swap.
 */
export default function ProjectColorPicker({
  projectName,
  color,
  getOwnerName,
  onPick,
}: ProjectColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<ProjectColor | null>(null);
  const lightTones = PROJECT_COLORS.filter((item) =>
    item.id.endsWith('-light'),
  );
  const darkTones = PROJECT_COLORS.filter((item) => item.id.endsWith('-dark'));
  const allTaken = PROJECT_COLORS.every(
    (item) => item.id === color?.id || getOwnerName(item),
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setPendingSwap(null);
    }
  }

  function handlePick(item: ProjectColor) {
    if (item.id === color?.id) {
      setOpen(false);
      return;
    }

    if (getOwnerName(item)) {
      setPendingSwap(item);
      return;
    }

    onPick(item);
    setOpen(false);
  }

  function confirmSwap() {
    if (pendingSwap) {
      onPick(pendingSwap);
    }

    handleOpenChange(false);
  }

  function renderSwatch(item: ProjectColor) {
    const owner = getOwnerName(item);
    const selected = item.id === color?.id;

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={owner ? `${item.name}, used by ${owner}` : item.name}
            aria-pressed={selected}
            onClick={() => handlePick(item)}
            className={cn(
              'relative flex h-7 w-7 items-center justify-center rounded-md bg-[var(--swatch)] ring-1 ring-black/10 ring-inset transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:ring-white/15',
            )}
            style={{ '--swatch': item.iconBackground } as CSSProperties}
          >
            {owner && (
              // A small dot marks a color another project uses. It can still
              // be picked: that asks first, then swaps.
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[var(--swatch-mark)]"
                style={{ '--swatch-mark': item.iconLogo } as CSSProperties}
              />
            )}
            {selected && (
              <Check
                className="h-4 w-4 text-[var(--swatch-mark)]"
                strokeWidth={3}
                style={{ '--swatch-mark': item.iconLogo } as CSSProperties}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {owner ? (
            <div className="flex flex-col gap-0.5">
              <span>
                {item.name}, used by{' '}
                <span className="font-semibold">{owner}</span>
              </span>
              <span className="text-muted-foreground text-xs">
                {color
                  ? 'You can still pick it: the two projects swap colors.'
                  : `You can still pick it: it moves to ${projectName}.`}
              </span>
            </div>
          ) : (
            item.name
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          aria-label={
            color
              ? `${projectName} color: ${color.name}. Change color`
              : `Pick a color for ${projectName}`
          }
          className="w-40 shrink-0 justify-between gap-2 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {color ? (
              <ProjectColorDot color={color} className="rounded-sm" />
            ) : (
              <span className="h-3 w-3 shrink-0 rounded-sm border border-muted-foreground/60 border-dashed" />
            )}
            <span className={cn('truncate', !color && 'text-muted-foreground')}>
              {color ? color.name : 'No color'}
            </span>
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto"
        // Don't focus the first swatch on open: it would pop its tooltip
        // over the hint text. Tab still moves into the grid.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {pendingSwap ? (
          <div className="flex w-72 flex-col gap-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ProjectColorDot color={pendingSwap} />
              {pendingSwap.name} is used by {getOwnerName(pendingSwap)}
            </div>
            <p className="text-muted-foreground">
              {color
                ? `Swap colors: ${projectName} gets ${pendingSwap.name.toLowerCase()} and ${getOwnerName(pendingSwap)} gets ${color.name.toLowerCase()}.`
                : `Move it to ${projectName}. ${getOwnerName(pendingSwap)} will have no color.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingSwap(null)}
              >
                Back
              </Button>
              <Button size="sm" onClick={confirmSwap}>
                {color ? 'Swap colors' : 'Move color'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allTaken && (
              <p className="text-muted-foreground text-xs">
                All colors are in use. Pick one to swap it.
              </p>
            )}
            <div className="grid grid-cols-9 gap-1.5">
              {lightTones.map(renderSwatch)}
              {darkTones.map(renderSwatch)}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
