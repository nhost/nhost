import { ProjectInfoCards } from '@/features/orgs/projects/common/components/ProjectInfoCards';

export default function OverviewProjectInfo() {
  return (
    <section className="grid grid-flow-row content-start gap-6">
      <h2 className="font-semibold text-lg">Project Info</h2>

      <ProjectInfoCards />
    </section>
  );
}
