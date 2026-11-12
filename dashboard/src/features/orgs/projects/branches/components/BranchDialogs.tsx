import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import { BranchStatusMark } from '@/features/orgs/projects/branches/components/BranchBits';
import {
  type Branch,
  timeAgo,
  toBranchSlug,
  useDummyBranches,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

const mono = 'font-medium font-mono';

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renames the branch in Nhost. The git branch it follows keeps its name, so
 * the branch stays linked to its pull request.
 */
export function RenameBranchDialog({
  branch,
  open,
  onOpenChange,
}: DialogBaseProps & { branch: Branch | null }) {
  const { branches, renameBranch } = useDummyBranches();
  const [name, setName] = useState('');
  useEffect(() => {
    if (open && branch) {
      setName(branch.name);
    }
  }, [open, branch]);

  if (!branch) {
    return null;
  }

  const taken = branches.some((b) => b.id !== branch.id && b.name === name);
  const unchanged = name === branch.name;

  function save() {
    if (!branch || !name || taken || unchanged) {
      return;
    }
    renameBranch(branch.id, name);
    onOpenChange(false);
    triggerToast(`Renamed to ${name}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename branch</DialogTitle>
            <DialogDescription>
              It still follows <span className={mono}>{branch.gitBranch}</span>{' '}
              on GitHub.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-branch">Name</Label>
            <Input
              id="rename-branch"
              autoComplete="off"
              autoFocus
              className="font-mono"
              value={name}
              onChange={(e) => setName(toBranchSlug(e.target.value))}
            />
            <p
              className={cn(
                'text-xs',
                taken ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {taken
                ? 'Another branch already has this name.'
                : 'Lowercase letters, numbers and hyphens.'}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name || taken || unchanged}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type StepStatus = 'succeeded' | 'running' | 'failed' | 'pending';

interface LogStep {
  name: string;
  status: StepStatus;
  duration?: string;
  lines: [time: string, text: string][];
}

// DUMMY: the steps of the branch's latest deployment, shaped like the
// deployment details page (one section per task, timestamped lines).
function dummySteps(branch: Branch): LogStep[] {
  const source = branch.isProduction ? 'main' : 'production';
  const steps: LogStep[] = [
    {
      name: 'Prepare branch',
      status: 'succeeded',
      duration: '4s',
      lines: [
        ['12:04:11', `Push to ${branch.gitBranch} received`],
        ['12:04:12', `Copying database structure from ${source}`],
        ['12:04:15', 'Database structure copied (no data)'],
      ],
    },
    {
      name: 'Apply migrations',
      status: 'succeeded',
      duration: '6s',
      lines: [
        ['12:04:16', 'Found 14 migrations'],
        ['12:04:21', 'Applied 14 migrations'],
      ],
    },
    {
      name: 'Apply metadata',
      status: 'succeeded',
      duration: '2s',
      lines: [
        ['12:04:22', 'Reloading metadata'],
        ['12:04:23', 'Metadata is consistent'],
      ],
    },
    {
      name: 'Deploy services',
      status: 'succeeded',
      duration: '8s',
      lines: [
        ['12:04:24', 'Starting auth, storage and functions'],
        ['12:04:31', 'Branch is ready'],
      ],
    },
  ];

  if (branch.status === 'failed') {
    steps[1] = {
      ...steps[1],
      status: 'failed',
      duration: '3s',
      lines: [
        ['12:04:16', 'Found 15 migrations'],
        ['12:04:18', 'Applying 1712345678_add_search_index'],
        [
          '12:04:19',
          'ERROR: column "title" of relation "posts" does not exist',
        ],
      ],
    };
    steps[2] = {
      ...steps[2],
      status: 'pending',
      duration: undefined,
      lines: [],
    };
    steps[3] = {
      ...steps[3],
      status: 'pending',
      duration: undefined,
      lines: [],
    };
  }

  if (branch.status === 'deploying' || branch.status === 'creating') {
    steps[2] = {
      ...steps[2],
      status: 'running',
      duration: undefined,
      lines: [['12:04:22', 'Reloading metadata']],
    };
    steps[3] = {
      ...steps[3],
      status: 'pending',
      duration: undefined,
      lines: [],
    };
  }

  return steps;
}

function StepMark({ status }: { status: StepStatus }) {
  if (status === 'running') {
    return <Loader2 className="size-3.5 animate-spin text-primary" />;
  }
  return (
    <span
      className={cn(
        'mx-1 size-2 rounded-full',
        status === 'succeeded' && 'bg-muted-foreground',
        status === 'failed' && 'bg-destructive',
        status === 'pending' && 'border border-muted-foreground',
      )}
    />
  );
}

/**
 * The branch's latest deployment, like the deployment details page: a summary
 * row, then one section per step with its log lines.
 */
export function BranchLogsDialog({
  branch,
  open,
  onOpenChange,
}: DialogBaseProps & { branch: Branch | null }) {
  if (!branch) {
    return null;
  }
  const steps = dummySteps(branch);
  // Open every step that has something to show.
  const expanded = steps
    .filter((s) => s.status !== 'pending')
    .map((s) => s.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Logs for <span className="font-mono">{branch.name}</span>
          </DialogTitle>
          <DialogDescription>
            Latest deployment of this branch.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">Status</dt>
            <dd className="mt-1">
              <BranchStatusMark status={branch.status} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">Git branch</dt>
            <dd className="mt-1 truncate font-mono text-xs">
              {branch.gitBranch}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Started</dt>
            <dd className="mt-1 text-xs">{timeAgo(branch.lastActivityAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Pushed by</dt>
            <dd className="mt-1 truncate text-xs">{branch.createdBy}</dd>
          </div>
        </dl>

        <Accordion
          type="multiple"
          defaultValue={expanded}
          className="max-h-96 overflow-y-auto rounded-md border"
        >
          {steps.map((step) => (
            <AccordionItem
              key={step.name}
              value={step.name}
              disabled={step.status === 'pending'}
              className="last:border-b-0"
            >
              <AccordionTrigger className="px-3 py-2.5 text-sm hover:no-underline">
                <span className="flex flex-1 items-center gap-2">
                  <StepMark status={step.status} />
                  <span
                    className={cn(
                      step.status === 'pending' && 'text-muted-foreground',
                    )}
                  >
                    {step.name}
                  </span>
                  {step.duration && (
                    <span className="ml-auto pr-2 text-muted-foreground text-xs">
                      {step.duration}
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="bg-muted/40 px-3 py-2 font-mono text-xs leading-6">
                {step.lines.map(([time, text]) => (
                  <div key={`${time}-${text}`} className="flex gap-3">
                    <span className="shrink-0 text-muted-foreground">
                      {time}
                    </span>
                    <span
                      className={cn(
                        'whitespace-pre-wrap break-all',
                        text.startsWith('ERROR') && 'text-destructive',
                      )}
                    >
                      {text}
                    </span>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
