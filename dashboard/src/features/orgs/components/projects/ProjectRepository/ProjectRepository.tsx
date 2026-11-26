import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import type { Project } from '@/features/orgs/components/projects/ProjectsGrid';

interface ProjectRepositoryProps {
  project: Project;
}

export default function ProjectRepository({ project }: ProjectRepositoryProps) {
  if (!project.githubRepository) {
    return null;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
      <GitHubIcon aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{project.githubRepository.fullName}</span>
    </span>
  );
}
