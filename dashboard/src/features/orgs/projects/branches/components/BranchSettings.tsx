import { useEffect, useState } from 'react';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsRow,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Switch } from '@/components/ui/v3/switch';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

/**
 * Branch settings: automatic branching (a branch for every pull request) and
 * the most branches it may create. There's no hard cap: the limit
 * is a safety net the user sets, 5 by default, and can be any number. One
 * card, so no card title (the page title says it).
 */
export default function BranchSettings() {
  const {
    automaticBranching,
    branchLimit,
    branchCount,
    repository,
    saveSettings,
    waiting,
  } = useDummyBranches();
  const [enabled, setEnabled] = useState(automaticBranching);
  const [limit, setLimit] = useState(String(branchLimit));

  // Pick up the saved values (and the demo reset).
  useEffect(() => setEnabled(automaticBranching), [automaticBranching]);
  useEffect(() => setLimit(String(branchLimit)), [branchLimit]);

  const parsed = Number(limit);
  const validLimit = Number.isInteger(parsed) && parsed >= 1;
  const dirty =
    enabled !== automaticBranching || (validLimit && parsed !== branchLimit);
  const belowCount = enabled && validLimit && parsed < branchCount;
  // How many waiting pull requests a save would give a branch to.
  const freed =
    enabled && validLimit
      ? Math.min(Math.max(0, parsed - branchCount), waiting.length)
      : 0;

  return (
    <SettingsCard asChild>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!dirty || (enabled && !validLimit)) {
            return;
          }
          saveSettings({
            automaticBranching: enabled,
            branchLimit: validLimit ? parsed : branchLimit,
          });
          triggerToast('Branch settings saved');
        }}
      >
        <SettingsCardContent>
          <SettingsRow
            title={
              <label htmlFor="automatic-branching">Automatic branching</label>
            }
            description={
              <>
                Create a branch for every pull request on{' '}
                <span className="font-mono">{repository}</span>.
              </>
            }
            action={
              <Switch
                id="automatic-branching"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            }
          />
          {/* Same row pattern as other settings cards. The limit only
              applies to automatic branching, so it shows only while that's
              on, like other toggles in the dashboard. Turning it off keeps
              the number: switch it back on and it's still there. */}
          {enabled && (
            <SettingsRow
              title={<label htmlFor="branch-limit">Branch limit</label>}
              // The explanation, then (only when needed) a line for an error
              // or a heads up. The count in use sits under the field.
              description={
                <>
                  The most branches open at once, not counting production.
                  {!validLimit ? (
                    <span className="mt-1 block text-destructive">
                      Enter a whole number, 1 or more.
                    </span>
                  ) : (
                    (belowCount && (
                      <span className="mt-1 block text-foreground">
                        Existing branches stay. New pull requests wait until you
                        have fewer than {parsed}.
                      </span>
                    )) ||
                    (freed > 0 && (
                      <span className="mt-1 block text-foreground">
                        Saving gives a branch to {freed} waiting pull{' '}
                        {freed === 1 ? 'request' : 'requests'}.
                      </span>
                    ))
                  )}
                </>
              }
              action={
                <div className="grid justify-items-end gap-1">
                  <Input
                    id="branch-limit"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    aria-describedby="branch-limit-usage"
                    className={cn('w-28', !validLimit && 'border-destructive')}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                  <span
                    id="branch-limit-usage"
                    className="text-muted-foreground text-xs"
                  >
                    {branchCount} in use
                    {waiting.length > 0 && `, ${waiting.length} waiting`}
                  </span>
                </div>
              }
            />
          )}
        </SettingsCardContent>
        <SettingsCardFooter>
          <Button type="submit" disabled={!dirty || (enabled && !validLimit)}>
            Save
          </Button>
        </SettingsCardFooter>
      </form>
    </SettingsCard>
  );
}
