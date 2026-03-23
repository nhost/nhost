import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import { ButtonWithLoading } from '@/components/ui/v3/button';

interface RetryableErrorCardProps {
  title: string;
  errorMessage?: string;
  onRetry: () => Promise<unknown>;
}

export default function RetryableErrorCard({
  title,
  errorMessage,
  onRetry,
}: RetryableErrorCardProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <TriangleAlert className="mx-auto size-10 text-amber-500" />
        <h3 className="font-semibold text-lg">{title}</h3>
        {errorMessage && (
          <div className="w-full rounded bg-[#f4f7f9] py-2 dark:bg-[#21262d]">
            <CodeBlock
              copyToClipboardToastTitle="Error details"
              className="!mt-0 rounded text-sm"
            >
              {errorMessage}
            </CodeBlock>
          </div>
        )}
        <ButtonWithLoading
          variant="outline"
          loading={isRetrying}
          onClick={async () => {
            setIsRetrying(true);
            try {
              await onRetry();
            } finally {
              setIsRetrying(false);
            }
          }}
        >
          Try Again
        </ButtonWithLoading>
      </div>
    </div>
  );
}
