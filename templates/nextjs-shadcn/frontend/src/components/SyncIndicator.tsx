'use client';

import { Check, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Stamp } from '@/components/WantSentence';

/**
 * The shortest time the spinner is shown, in milliseconds.
 *
 * A local mutation against a container on the same machine can come back in
 * under 50ms, which is faster than the eye can resolve as motion: the spinner
 * would appear and vanish as a flicker, reading as a glitch rather than as
 * work. Holding it for one full turn of the icon means the spin is always seen
 * as a spin, and the tick that follows means something arrived.
 */
const MIN_SPIN_MS = 750;

/**
 * Says whether what is on screen has reached the server yet.
 *
 * The list writes on blur and on every toggle, so there is no save button to
 * watch and nothing that obviously corresponds to "it is stored now". This is
 * that, in the corner: spinning while a write is in flight, a tick when it
 * lands, and the time of the last one the rest of the while. It says "last
 * saved" rather than "saved" because the stamp is the older fact of the two -
 * without the word, a time sitting there minutes later reads as a claim that
 * something is being saved now.
 */
export function SyncIndicator({
  isSyncing,
  className,
}: {
  isSyncing: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  const [settledAt, setSettledAt] = useState<string | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (isSyncing) {
      startedAt.current = Date.now();
      setShown(true);
      return;
    }

    if (!shown) {
      return;
    }

    // Hold the spinner to its minimum before letting it become a tick.
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(MIN_SPIN_MS - elapsed, 0);

    const stop = setTimeout(() => {
      setShown(false);
      setSettledAt(new Date().toISOString());
    }, wait);

    return () => clearTimeout(stop);
  }, [isSyncing, shown]);

  // Nothing has been written yet this visit, so there is nothing to report.
  if (!shown && !settledAt) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-1.5 text-muted-foreground/60 text-xs tabular-nums ${className ?? ''}`}
    >
      {shown ? (
        <>
          <RefreshCw className="size-3 animate-spin" aria-hidden />
          Saving
        </>
      ) : (
        <>
          {/* Keyed on the timestamp so the animation replays for each save
              rather than only for the first: React keeps the element between
              renders otherwise, and a CSS animation on a kept element does not
              start again. */}
          <Check
            key={settledAt}
            className="size-3 animate-[sync-settle_360ms_ease-out]"
            aria-hidden
          />
          Last Saved: <Stamp value={settledAt} layout="inline" />
        </>
      )}
    </p>
  );
}
