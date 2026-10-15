import ProjectColorDot from '@/features/project-colors/components/ProjectColorDot';
import useProjectColors from '@/features/project-colors/hooks/useProjectColors';
import { cn } from '@/lib/utils';

export interface ProjectColorBadgeProps {
  projectId?: string | null;
  projectName?: string | null;
  className?: string;
}

/**
 * The project's name with its color, for dialogs that act on one project
 * (delete, transfer, pause), so it's clear which project is affected. Shows
 * nothing when the project has no color or project colors are off.
 */
export default function ProjectColorBadge({
  projectId,
  projectName,
  className,
}: ProjectColorBadgeProps) {
  const { enabled, getColorFor } = useProjectColors();
  const color = enabled ? getColorFor(projectId) : undefined;

  if (!color || !projectName) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 font-medium text-foreground text-sm',
        className,
      )}
    >
      <ProjectColorDot color={color} />
      {projectName}
    </span>
  );
}
