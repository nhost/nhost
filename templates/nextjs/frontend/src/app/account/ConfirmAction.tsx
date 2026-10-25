'use client';

import { type FormEvent, useId, useState } from 'react';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The answers to a dialog that asks before it acts.
 *
 * Cancel comes first, which is where the dialog puts focus on opening, so an
 * Enter pressed out of habit backs out rather than acts. With `typeToConfirm`
 * the action also waits for that word to be typed, for the one that cannot
 * be undone.
 */
export default function ConfirmAction({
  confirm,
  pending: pendingLabel,
  cancel = 'Cancel',
  destructive = false,
  typeToConfirm,
  onConfirm,
}: {
  confirm: string;
  pending: string;
  cancel?: string;
  destructive?: boolean;
  typeToConfirm?: string;
  /** Resolves to an error to show, or to nothing once it has acted. */
  onConfirm: () => Promise<string | undefined>;
}) {
  const typedId = useId();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const confirmed = !typeToConfirm || typed.trim() === typeToConfirm;

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!confirmed) {
      return;
    }

    setError(undefined);
    setPending(true);
    try {
      setError(await onConfirm());
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {typeToConfirm ? (
        <div className="flex flex-col gap-2">
          {/* One span, so the label's flex gap does not space out the word. */}
          <Label htmlFor={typedId} className="font-normal">
            <span>
              Type <span className="font-semibold">{typeToConfirm}</span> to
              confirm
            </span>
          </Label>
          <Input
            id={typedId}
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={pending}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={pending}>{cancel}</DialogClose>
        <Button
          type="submit"
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
          disabled={pending || !confirmed}
        >
          {pending ? pendingLabel : confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}
