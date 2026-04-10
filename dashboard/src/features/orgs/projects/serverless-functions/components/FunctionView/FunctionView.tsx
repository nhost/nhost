import { useRouter } from 'next/router';
import { Spinner } from '@/components/ui/v3/spinner';
import { FunctionsEmptyState } from '@/features/orgs/projects/serverless-functions/components/FunctionsEmptyState';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-b-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-medium text-sm">{value}</dd>
    </div>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function FunctionDetails({ fn }: { fn: NhostFunction }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 bg-background p-6">
        <h1 className="mb-1 font-semibold text-gray-900 text-xl dark:text-gray-100">
          {fn.route}
        </h1>
        <p className="text-gray-600 text-sm dark:text-gray-400">{fn.path}</p>
      </div>

      <div className="overflow-auto p-6">
        <dl>
          <DetailRow label="File Path" value={fn.path} />
          <DetailRow label="Route" value={fn.route} />
          <DetailRow label="Runtime" value={fn.runtime} />
          <DetailRow label="Created At" value={formatDate(fn.createdAt)} />
          <DetailRow label="Updated At" value={formatDate(fn.updatedAt)} />
          <DetailRow
            label="Deployed from commit"
            value={fn.createdWithCommitSha.slice(0, 7)}
          />
        </dl>
      </div>
    </div>
  );
}

export default function FunctionView() {
  const router = useRouter();
  const { functionSlug } = router.query;

  const { data: functions, loading, error } = useGetNhostFunctions();

  if (loading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{functionSlug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  const fn = functions.find((f) => f.route.replace(/^\//, '') === functionSlug);

  if (!fn) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{functionSlug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return <FunctionDetails fn={fn} />;
}
