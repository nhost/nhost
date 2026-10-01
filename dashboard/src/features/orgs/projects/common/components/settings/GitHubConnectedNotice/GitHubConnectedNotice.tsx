import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { TextLink } from '@/components/ui/v3/text-link';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

/**
 * The sync reminder shown on settings pages while a GitHub repository is
 * connected to the project.
 */
export default function GitHubConnectedNotice() {
  const { project } = useProject();

  if (!project?.githubRepository) {
    return null;
  }

  return (
    <Alert variant="info">
      <AlertTitle>GitHub repository connected</AlertTitle>
      <AlertDescription>
        Run <InlineCode>nhost config pull</InlineCode> to sync your changes. To
        connect multiple projects to the same repository, use{' '}
        <TextLink
          href="https://docs.nhost.io/platform/cli/configuration-overlays"
          target="_blank"
          rel="noreferrer"
        >
          configuration overlays
        </TextLink>
        .
      </AlertDescription>
    </Alert>
  );
}
