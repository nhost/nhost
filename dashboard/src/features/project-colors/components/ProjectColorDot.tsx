import type { CSSProperties } from 'react';
import type { ProjectColor } from '@/features/project-colors/lib/palette';
import { cn } from '@/lib/utils';

export interface ProjectColorDotProps {
  color: ProjectColor;
  className?: string;
}

/** A small round swatch of a project color, the same in light and dark mode. */
export default function ProjectColorDot({
  color,
  className,
}: ProjectColorDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--project-dot)] ring-1 ring-black/10 ring-inset dark:ring-white/15',
        className,
      )}
      style={{ '--project-dot': color.iconBackground } as CSSProperties}
    />
  );
}
