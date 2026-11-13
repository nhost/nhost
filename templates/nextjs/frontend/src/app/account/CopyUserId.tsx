'use client';

import { useToast } from '@/components/Toast';

/** The account's id as a chip that copies it. */
export default function CopyUserId({ id }: { id: string }) {
  const toast = useToast();

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(id);
      toast('User ID copied');
    } catch (err) {
      console.error('Error copying the user ID:', err);
      toast('Could not copy the user ID');
    }
  };

  return (
    <button
      type="button"
      title={id}
      aria-label="Copy user ID"
      onClick={() => void copy()}
      className="inline-flex h-6 min-w-0 max-w-full cursor-pointer items-center whitespace-nowrap gap-1.5 rounded-full border bg-secondary px-2.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      ID
      <span className="min-w-0 truncate font-mono">{id}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3 shrink-0"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    </button>
  );
}
