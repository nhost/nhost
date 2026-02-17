import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue } from '@/lib/utils';

export default function GitRepoMetadataAlert() {
  const { project } = useProject();

  if (isEmptyValue(project?.githubRepository)) {
    return null;
  }

  return (
    <Alert className="flex justify-center rounded-none border-primary/20 border-x-0 bg-primary-light px-4 py-3 dark:bg-primary/10">
      <div className="flex w-full max-w-5xl flex-col justify-center">
        <AlertTitle className="!text-sm+ text-center font-medium text-primary">
          GitHub Repository Connected
        </AlertTitle>
        <AlertDescription className="text-center text-muted-foreground text-xs">
          <p>
            Any manual changes to the metadata may be overridden by the next
            deployment.
          </p>
          <p>
            To persist changes, update your Hasura metadata files in the
            repository and deploy.
          </p>
        </AlertDescription>
      </div>
    </Alert>
  );
}
