import type { Project } from '@/features/orgs/components/projects/ProjectsGrid';

interface ProjectRepositoryProps {
  project: Project;
}

// No GitHub icon: it's the only provider, and "owner/repo · branch" already
// reads as a repository. The avatar below stays the card's only icon.
export default function ProjectRepository({ project }: ProjectRepositoryProps) {
  if (!project.githubRepository) {
    return null;
  }

  return (
    <span className="min-w-0 truncate text-muted-foreground text-xs">
      {project.githubRepository.fullName}
      {project.repositoryProductionBranch &&
        ` · ${project.repositoryProductionBranch}`}
    </span>
  );
}
