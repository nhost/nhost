import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Button } from '@/components/ui/v3/button';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { RemoveApplicationDialog } from '@/features/orgs/projects/common/components/RemoveApplicationDialog';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function ApplicationUnknown() {
  const { project, loading } = useProject();
  const isOwner = useIsCurrentUserOwner();

  if (!project || loading) {
    return <LoadingScreen />;
  }

  const removeProjectTitle = (
    <>
      Remove project{' '}
      <span className="select-none whitespace-pre-wrap break-words">
        {project.name}
      </span>
      {'?'}
    </>
  );
  const removeProjectDescription = (
    <>
      The project{' '}
      <span className="select-none whitespace-pre-wrap break-words">
        {project.name}
      </span>{' '}
      will be removed. All data will be lost and there will be no way to recover
      the app once it has been deleted.
    </>
  );

  return (
    <Container className="mx-auto mt-8 grid max-w-sm grid-flow-row gap-4 text-center">
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/assets/ProvisioningFailed.svg"
          alt="Danger sign"
          width={72}
          height={72}
        />
      </div>

      <div id="setting-up" className="grid grid-flow-row gap-1">
        <h1 className="font-medium text-lg">Unknown project state</h1>

        <p className="mt-1 font-normal text-sm">
          Something on our end went wrong and we could not finish setup. If this
          keeps happening,{' '}
          <Link
            className="font-semibold underline underline-offset-2"
            href="/support"
            target="_blank"
            rel="noopener noreferrer"
          >
            contact support
          </Link>
          .
        </p>
      </div>

      <div className="mx-auto grid grid-flow-row gap-2">
        {isOwner && (
          <RemoveApplicationDialog
            title={removeProjectTitle}
            description={removeProjectDescription}
            trigger={
              <Button
                variant="destructive"
                className="mx-auto w-full max-w-[240px]"
              >
                Delete Project
              </Button>
            }
          />
        )}
      </div>

      <StagingMetadata>
        <ApplicationInfo />
      </StagingMetadata>
    </Container>
  );
}
