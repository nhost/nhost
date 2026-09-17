'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const STEPS_KEY = 'next-steps-visited';

const steps = [
  {
    href: '/profile',
    lead: 'Visit',
    link: 'your profile',
    trail: ' to update name, image, and password',
  },
  {
    href: '/protected',
    lead: 'Go to the',
    link: 'protected page',
    trail: ' to read and write to your own data table',
  },
];

function read(): string[] {
  try {
    const stored = localStorage.getItem(STEPS_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Where to go once the tiles are all green, in the order worth doing it: the
 * profile touches auth, storage and a function, and the protected page is more
 * interesting once there is a name on the account.
 *
 * A step ticks when you open it. That is a record of where you have been, not
 * of what you have built, so it is kept in the browser rather than written to
 * the account: the tiles above are the ones that report real state.
 *
 * Read after mount rather than during render, because the server has no way to
 * know what this browser has already seen and guessing would mean a first
 * paint that hydration then disagrees with.
 */
export function NextSteps() {
  const [visited, setVisited] = useState<string[]>([]);

  useEffect(() => setVisited(read()), []);

  const visit = (href: string): void => {
    const next = [...new Set([...read(), href])];
    setVisited(next);

    try {
      localStorage.setItem(STEPS_KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse storage; the link still works.
    }
  };

  return (
    // Set further from the tiles than they are from each other: it is a note
    // about them rather than another one of them. Each row is centred on its
    // own, rather than the block being centred on its widest row, which left
    // the shorter line looking pushed to one side.
    <div className="mt-6 flex flex-col gap-3">
      <h2 className="text-center font-semibold text-base text-foreground">
        Next steps
      </h2>

      <ol className="flex flex-col gap-2.5 text-base text-muted-foreground">
        {steps.map((step, index) => {
          const done = visited.includes(step.href);

          return (
            <li
              key={step.href}
              className="flex items-start justify-center gap-3"
            >
              {/* Carries the step's number until it is done, which is what
                  lets the text drop the "Step 1" it used to start with. Held
                  to the top rather than centred, so it stays beside the first
                  line when the text wraps on a narrow screen; the nudge down
                  centres it on that line rather than on its ascenders. */}
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-medium text-xs transition-colors',
                  done
                    ? 'border-foreground/40 text-emerald-500'
                    : 'border-muted-foreground/50 text-muted-foreground',
                )}
              >
                {done ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>

              <span className={cn(done && 'line-through opacity-60')}>
                {step.lead}{' '}
                <Link
                  href={step.href}
                  onClick={() => visit(step.href)}
                  className="text-foreground underline underline-offset-4"
                >
                  {step.link}
                </Link>
                {step.trail}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
