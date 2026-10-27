import { SiGithub } from '@icons-pack/react-simple-icons';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

const SYNC_COMMAND = 'nhost config pull';

/**
 * The sync reminder shown on settings pages while a GitHub repository is
 * connected to the project: one compact line with the repository, the command
 * to keep it in sync and a link to the docs.
 */
export default function GitHubConnectedNotice() {
  const { project } = useProject();

  if (!project?.githubRepository) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-4 py-1.5 text-muted-foreground text-sm">
      <SiGithub
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-foreground"
      />
      <span>
        <span className="font-medium text-foreground">
          {project.githubRepository.fullName || 'Repository'}
        </span>{' '}
        connected. Run
      </span>
      <span className="inline-flex items-center gap-1">
        <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary text-xs">
          {SYNC_COMMAND}
        </code>
        <Tooltip>
          <TooltipTrigger asChild>
            <CopyToClipboardButton
              textToCopy={SYNC_COMMAND}
              title="Command"
              aria-label="Copy command"
            />
          </TooltipTrigger>
          <TooltipContent>Copy command</TooltipContent>
        </Tooltip>
      </span>
      <span>after changes to keep your repo in sync.</span>
      <span>
        Multiple projects on one repo?{' '}
        <TextLink
          href="https://docs.nhost.io/platform/cli/configuration-overlays"
          external
        >
          Learn about configuration overlays
        </TextLink>
      </span>
    </div>
  );
}
