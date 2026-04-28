import { useRouter } from 'next/router';
import { Spinner } from '@/components/ui/v3/spinner';
import { FunctionDetailsPanel } from '@/features/orgs/projects/serverless-functions/components/FunctionDetailsPanel';
import { FunctionsEmptyState } from '@/features/orgs/projects/serverless-functions/components/FunctionsEmptyState';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';
import { isEmptyValue } from '@/lib/utils';

export default function ServerlessFunctionView() {
  const router = useRouter();
  const { functionSlug } = router.query;
  const slug = Array.isArray(functionSlug)
    ? functionSlug.join('/')
    : (functionSlug as string);

  const { data: functions, loading, error } = useGetNhostFunctions();

  if (loading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  const fn = functions.find((func) => func.route.replace(/^\//, '') === slug);

  if (error || isEmptyValue(fn)) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{slug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return <FunctionDetailsPanel fn={fn!} />;
}
