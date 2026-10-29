import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { isCommitSHA } from '@/features/orgs/projects/deployments/utils/isCommitSHA';

export interface CommitRefProps {
  commitRef: string | null | undefined;
}

export default function CommitRef({ commitRef }: CommitRefProps) {
  const isSHA = isCommitSHA(commitRef);

  return (
    <div className="group hidden w-24 items-center justify-end gap-1 sm:flex">
      <span
        title={commitRef ?? undefined}
        className="max-w-16 truncate font-medium font-mono text-foreground text-sm-"
      >
        {isSHA ? commitRef.substring(0, 7) : commitRef}
      </span>
      <CopyToClipboardButton
        textToCopy={commitRef}
        title={isSHA ? 'Commit SHA' : 'Ref'}
        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
      />
    </div>
  );
}
