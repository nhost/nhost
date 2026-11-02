import { Eraser } from 'lucide-react';
import {
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { Switch } from '@/components/ui/v3/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import {
  ProjectColorPicker,
  useProjectColors,
} from '@/features/project-colors';

/**
 * Personal project colors: each project the person can see, grouped by
 * organization, with its color. Only this person sees their colors.
 */
export default function ProjectColorsSettings() {
  const { orgs } = useOrgs();
  const {
    enabled,
    setEnabled,
    getColorFor,
    getOwnerOf,
    assignColor,
    removeColor,
  } = useProjectColors();
  const projectNames = new Map(
    orgs.flatMap((org) => org.apps.map((app) => [app.id, app.name] as const)),
  );
  const orgsWithProjects = orgs.filter((org) => org.apps.length > 0);

  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        title="Project colors"
        description="Give each project its own color: a thin line across the top of the page and a colored browser tab icon, so you always know which project you're in. Only you see your colors."
        control={
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Show project colors"
          />
        }
      />

      {enabled && (
        <SettingsCardContent className="gap-6">
          {orgsWithProjects.map((org) => (
            <section key={org.id} className="flex flex-col gap-2">
              <h4 className="font-medium text-muted-foreground text-sm">
                {org.name}
              </h4>
              <ul className="divide-y rounded-lg border">
                {org.apps.map((app) => {
                  const color = getColorFor(app.id);

                  return (
                    <li
                      key={app.id}
                      className="flex min-h-14 items-center gap-3 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-sm">
                        {app.name}
                      </span>
                      {color && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="subtle"
                              aria-label={`Remove color from ${app.name}`}
                              onClick={() => removeColor(app.id)}
                            >
                              <Eraser />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove color</TooltipContent>
                        </Tooltip>
                      )}
                      <ProjectColorPicker
                        projectName={app.name}
                        color={color}
                        getOwnerName={(item) => {
                          const owner = getOwnerOf(item.id);
                          return owner && owner !== app.id
                            ? projectNames.get(owner)
                            : undefined;
                        }}
                        onPick={(item) => assignColor(app.id, item.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <p className="text-muted-foreground text-xs">
            For now your colors are saved in this browser only.
          </p>
        </SettingsCardContent>
      )}
    </AccountSettingsCard>
  );
}
