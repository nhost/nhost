import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { useProjectColor } from '@/features/orgs/projects/common/hooks/useProjectColor';
import { PROJECT_COLOR_PALETTE } from '@/features/orgs/projects/common/utils/projectColor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';

export default function ProjectColorPicker() {
  const { project } = useProject();
  const { color, setColor } = useProjectColor(project?.id);

  return (
    <SettingsContainer
      title="Project Color"
      description="A color used to highlight this project across the dashboard. Useful for distinguishing production, staging, and development at a glance. Stored locally in your browser."
      className="grid grid-flow-row px-4"
      slotProps={{
        footer: { className: 'hidden' },
      }}
    >
      <div className="flex flex-wrap gap-3">
        {PROJECT_COLOR_PALETTE.map((entry) => {
          const isActive = entry.name === color;
          return (
            <button
              key={entry.name}
              type="button"
              aria-label={entry.label}
              aria-pressed={isActive}
              disabled={!project}
              onClick={() => setColor(entry.name)}
              className={cn(
                'h-8 w-8 rounded-full transition-shadow',
                entry.swatch,
                isActive &&
                  'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          );
        })}
      </div>
    </SettingsContainer>
  );
}
