import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
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
import type {
  Branch,
  MergeRequest,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { triggerToast } from '@/utils/toast';

const mono = 'font-medium font-mono';

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Deletes one branch or several selected ones. One branch: type its name to
 * confirm. Several: type "delete".
 */
export function DeleteBranchDialog({
  branches,
  open,
  onOpenChange,
  onDeleted,
}: DialogBaseProps & { branches: Branch[]; onDeleted?: () => void }) {
  const { deleteBranches, openRequestFor } = useDummyBranches();
  const [confirm, setConfirm] = useState('');
  useEffect(() => {
    if (open) {
      setConfirm('');
    }
  }, [open]);

  if (branches.length === 0) {
    return null;
  }
  const single = branches.length === 1 ? branches[0] : null;
  const phrase = single ? single.name : 'delete';
  const requests = branches
    .map((b) => openRequestFor(b.name))
    .filter((r): r is MergeRequest => r !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {single ? 'Delete branch' : `Delete ${branches.length} branches`}
          </DialogTitle>
          <DialogDescription>
            {single ? (
              <>
                This removes <span className={mono}>{single.name}</span> and
                everything in it. Production isn't affected.
              </>
            ) : (
              <>
                This removes these branches and everything in them. Production
                isn't affected.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {!single && (
          <ul className="max-h-40 overflow-y-auto rounded-md border px-3 py-2 font-mono text-sm">
            {branches.map((b) => (
              <li key={b.id} className="truncate py-0.5">
                {b.name}
              </li>
            ))}
          </ul>
        )}
        {requests.length > 0 && (
          <Alert variant="warning" className="py-3">
            <AlertDescription>
              {requests.length === 1
                ? `Merge request #${requests[0].number} will be closed without merging.`
                : `${requests.length} open merge requests will be closed without merging.`}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="confirm-delete-branch">
            Type <span className={mono}>{phrase}</span> to confirm
          </Label>
          <Input
            id="confirm-delete-branch"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline-emboss" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirm !== phrase}
            onClick={() => {
              deleteBranches(branches.map((b) => b.id));
              onOpenChange(false);
              onDeleted?.();
              triggerToast(
                single
                  ? `Deleted ${single.name}`
                  : `Deleted ${branches.length} branches`,
              );
            }}
          >
            {single ? 'Delete branch' : `Delete ${branches.length} branches`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MergeDialog({
  request,
  open,
  onOpenChange,
}: DialogBaseProps & { request: MergeRequest | null }) {
  const { merge } = useDummyBranches();
  const [deleteAfter, setDeleteAfter] = useState(false);
  useEffect(() => setDeleteAfter(false), []);

  if (!request) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Merge into <span className="text-primary">production</span>
          </DialogTitle>
          <DialogDescription>
            #{request.number} {request.title}. The changes on{' '}
            <span className={mono}>{request.branchName}</span> go live in{' '}
            <span className={mono}>production</span>.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="info" className="py-3">
          <Info className="size-4" />
          <AlertDescription>
            A preview of the changes isn't available yet. Check them on the
            branch before merging.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <Checkbox
            id="delete-after-merge"
            checked={deleteAfter}
            onCheckedChange={(v) => setDeleteAfter(v === true)}
          />
          <Label htmlFor="delete-after-merge" className="font-normal">
            Delete <span className={mono}>{request.branchName}</span> after
            merging
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline-emboss" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              merge(request.id, deleteAfter);
              onOpenChange(false);
              triggerToast(`Merged ${request.branchName} into production`);
            }}
          >
            Merge into production
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function suggestTitle(name: string) {
  const words = name.replace(/^(feature|fix|chore)-/, '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function OpenRequestDialog({
  branch,
  open,
  onOpenChange,
}: DialogBaseProps & { branch: Branch | null }) {
  const { openMergeRequest } = useDummyBranches();
  const [title, setTitle] = useState('');
  useEffect(() => setTitle(branch ? suggestTitle(branch.name) : ''), [branch]);

  if (!branch) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open merge request</DialogTitle>
          <DialogDescription>
            Ask to merge <span className={mono}>{branch.name}</span> into{' '}
            <span className={mono}>production</span>. Nothing changes until
            someone merges it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="merge-request-title">Title</Label>
          <Input
            id="merge-request-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline-emboss" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              openMergeRequest(branch.name, title.trim());
              onOpenChange(false);
              triggerToast('Merge request opened');
            }}
          >
            Open merge request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BranchLogsDialog({
  branch,
  open,
  onOpenChange,
}: DialogBaseProps & { branch: Branch | null }) {
  if (!branch) {
    return null;
  }
  const lines = [
    ['12:04:11', 'info', `Branch ${branch.name} requested`],
    ['12:04:12', 'info', 'Copying database structure from production'],
    ['12:04:19', 'info', 'Applying 14 migrations'],
    ['12:04:23', 'info', 'Applying metadata'],
    ['12:04:25', 'info', 'Starting services'],
    ['12:04:31', 'info', 'Branch is ready'],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Logs for <span className="font-mono">{branch.name}</span>
          </DialogTitle>
          <DialogDescription>Latest activity on this branch.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-6">
          {lines.map(([time, level, text]) => (
            <div key={time} className="flex gap-3">
              <span className="text-muted-foreground">{time}</span>
              <span className="text-primary">{level}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
