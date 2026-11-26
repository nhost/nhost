import type { ReactNode } from 'react';

/** A file path or command inside running text. */
export default function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
}
