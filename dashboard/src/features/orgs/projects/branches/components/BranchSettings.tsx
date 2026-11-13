import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { DatabaseBackup, type LucideIcon, Sprout, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsRow,
} from '@/components/layout/SettingsCard';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Switch } from '@/components/ui/v3/switch';
import {
  type InitialData,
  useDummyBranches,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

/**
 * Two cards, because they answer different questions:
 * - Automatic branching: does a pull request get a branch, and how many at
 *   once (the limit belongs to it, so it lives inside it).
 * - Starting data: what's inside each new branch's database.
 * Multi card page, so each card has its own title and its own Save.
 */
export default function BranchSettings() {
  // Two independent cards. Starting data always shows: it describes every
  // new branch, however it gets created (pull requests now, manual later).
  return (
    <div className="grid gap-6">
      <AutomaticBranchingCard />
      <StartingDataCard />
    </div>
  );
}

function AutomaticBranchingCard() {
  const {
    automaticBranching,
    branchLimit,
    branchCount,
    initialData,
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
  const canSave = dirty && (!enabled || validLimit);

  return (
    <SettingsCard asChild>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) {
            return;
          }
          saveSettings({
            automaticBranching: enabled,
            branchLimit: validLimit ? parsed : branchLimit,
            initialData,
          });
          triggerToast('Automatic branching saved');
        }}
      >
        <SettingsCardHeader
          title="Automatic branching"
          description={
            <>
              Create a branch for every pull request on{' '}
              <span className="font-mono">{repository}</span>.
            </>
          }
          control={
            <Switch
              aria-label="Automatic branching"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          }
        />
        {/* The toggle shows its setting when on and hides it when off,
            keeping the number for next time. */}
        {enabled && (
          <SettingsCardContent>
            {/* Boxed like the Starting data cards: a sub-setting that
                belongs to the switch above. */}
            <div className="rounded-lg border p-4">
              <SettingsRow
                title={<label htmlFor="branch-limit">Branch limit</label>}
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
                          Existing branches stay. New pull requests wait until
                          you have fewer than {parsed}.
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
                      className={cn(
                        'w-28',
                        !validLimit && 'border-destructive',
                      )}
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
            </div>
          </SettingsCardContent>
        )}
        <SettingsCardFooter>
          <Button type="submit" disabled={!canSave}>
            Save
          </Button>
        </SettingsCardFooter>
      </form>
    </SettingsCard>
  );
}

const STARTING_DATA: {
  value: InitialData;
  icon: LucideIcon;
  label: string;
  description: string;
}[] = [
  {
    value: 'empty',
    icon: Table2,
    label: 'Empty',
    description: 'Tables and settings only, no rows.',
  },
  {
    value: 'seed',
    icon: Sprout,
    label: 'Seed data',
    description: 'Runs the seed files in nhost/seeds after the migrations.',
  },
  {
    value: 'parentBackup',
    icon: DatabaseBackup,
    label: 'Production backup',
    description: "Restores production's latest backup, real data included.",
  },
];

function StartingDataCard() {
  const { automaticBranching, branchLimit, initialData, saveSettings } =
    useDummyBranches();
  const [data, setData] = useState<InitialData>(initialData);
  useEffect(() => setData(initialData), [initialData]);

  return (
    <SettingsCard asChild>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (data === initialData) {
            return;
          }
          saveSettings({ automaticBranching, branchLimit, initialData: data });
          triggerToast('Starting data saved');
        }}
      >
        <SettingsCardHeader
          title="Starting data"
          description="What a new branch's database starts with. Existing branches keep theirs."
        />
        <SettingsCardContent>
          {/* Select cards side by side: each choice reads at a glance, and
              the one that copies real data can't hide in a menu. */}
          {/* Each card is the radio itself (no circle): click anywhere on
              it, arrow keys move between them. The border says which one is
              picked. */}
          <RadioGroupPrimitive.Root
            aria-label="Starting data"
            value={data}
            onValueChange={(value) => setData(value as InitialData)}
            className="grid gap-3 md:grid-cols-3"
          >
            {STARTING_DATA.map((option) => (
              <RadioGroupPrimitive.Item
                key={option.value}
                value={option.value}
                className="group flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
              >
                {/* Icon tile: gray at rest, primary when picked. These
                    three icons aren't used anywhere else in the dashboard. */}
                <span className="mb-2 grid size-10 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-data-[state=checked]:bg-primary/15 group-data-[state=checked]:text-primary">
                  <option.icon className="size-5" />
                </span>
                <span className="font-medium text-foreground text-sm">
                  {option.label}
                </span>
                <span className="text-muted-foreground text-sm">
                  {option.description}
                </span>
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroupPrimitive.Root>
          {/* Only once it's picked. A warning, not an error: it's a valid
              choice with a cost (real user data in every branch). */}
          {data === 'parentBackup' && (
            <Alert variant="warning">
              <AlertDescription>
                Every pull request branch gets a copy of your users and their
                data, and the pull request's code can read all of it.
              </AlertDescription>
            </Alert>
          )}
        </SettingsCardContent>
        <SettingsCardFooter>
          <Button type="submit" disabled={data === initialData}>
            Save
          </Button>
        </SettingsCardFooter>
      </form>
    </SettingsCard>
  );
}
