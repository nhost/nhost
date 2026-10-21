'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import AccountSection from '@/app/account/AccountSection';
import Swap, { Fade } from '@/components/Swap';
import { Button } from '@/components/ui/button';

/**
 * A section whose one action asks before it acts, without opening anything.
 *
 * The first press turns the button into the answers and the description
 * into the question, in place. Everything is laid out from the start and
 * cross-fades, so the section is the same height and width asking or not,
 * and nothing on the page moves.
 *
 * Cancel takes the exact place of the button that asked, stretched to its
 * width, so a double click that was meant as one press cancels rather than
 * acts. The button that acts is beside it, in space kept for it all along.
 *
 * A press anywhere else, or Escape, backs out the same as Cancel: the
 * question is about this button, and a visitor who has moved on from it has
 * answered.
 */
export default function ConfirmInPlace({
  title,
  description,
  warning,
  start,
  confirm,
  pending: pendingLabel,
  cancel = 'Cancel',
  destructive = false,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  warning: ReactNode;
  start: string;
  confirm: string;
  pending: string;
  cancel?: string;
  destructive?: boolean;
  /** Resolves to an error to show, or to nothing once it has acted. */
  onConfirm: () => Promise<string | undefined>;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const buttons = useRef<HTMLDivElement>(null);

  // Not while the request is out: backing out then would hide the answer
  // without stopping what it answers.
  useEffect(() => {
    if (!asking || pending) {
      return;
    }

    const cancel = (): void => {
      setAsking(false);
      setError(undefined);
    };
    const onPointerDown = (event: Event): void => {
      if (!buttons.current?.contains(event.target as Node)) {
        cancel();
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        cancel();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [asking, pending]);

  const handleConfirm = async (): Promise<void> => {
    setError(undefined);
    setPending(true);
    try {
      setError(await onConfirm());
    } finally {
      setPending(false);
    }
  };

  return (
    <AccountSection
      title={title}
      description={
        <Swap showSecond={asking} first={description} second={warning} />
      }
      action={
        <div ref={buttons} className="flex items-center gap-2">
          <Fade show={asking}>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              size="sm"
              disabled={pending}
              onClick={() => void handleConfirm()}
            >
              {pending ? pendingLabel : confirm}
            </Button>
          </Fade>
          <Swap
            showSecond={asking}
            first={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAsking(true)}
              >
                {start}
              </Button>
            }
            second={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={pending}
                onClick={() => {
                  setAsking(false);
                  setError(undefined);
                }}
              >
                {cancel}
              </Button>
            }
          />
        </div>
      }
    >
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </AccountSection>
  );
}
