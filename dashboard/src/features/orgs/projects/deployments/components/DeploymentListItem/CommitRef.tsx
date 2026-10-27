import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';

export interface CommitRefProps {
  commitRef: string | null | undefined;
}

export default function CommitRef({ commitRef }: CommitRefProps) {
  const isCommitSHA = /^[\da-f]{40}$/i.test(commitRef ?? '');

  return (
    <div className="group hidden w-24 items-center justify-end gap-1 sm:flex">
      <span
        title={commitRef ?? undefined}
        className="max-w-16 truncate font-medium font-mono text-foreground text-sm-"
      >
        {isCommitSHA ? commitRef?.substring(0, 7) : commitRef}
      </span>
      <CopyToClipboardButton
        textToCopy={commitRef}
        title={isCommitSHA ? 'Commit SHA' : 'Ref'}
        aria-label={isCommitSHA ? 'Copy commit SHA' : 'Copy ref'}
        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
      />
    </div>
  );
}
