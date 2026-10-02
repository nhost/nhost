import Image from 'next/image';
import {
  InfoCard,
  type InfoCardProps,
} from '@/features/orgs/projects/common/components/InfoCard';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';

export interface ProjectInfoCardsProps {
  /**
   * Layout of the individual cards.
   */
  layout?: InfoCardProps['layout'];
}

export default function ProjectInfoCards({ layout }: ProjectInfoCardsProps) {
  const { project } = useProject();

  if (!isNotEmptyValue(project)) {
    return null;
  }

  const isRegionAvailable = !!(
    project.region?.name &&
    project.region?.countryCode &&
    project.region?.city
  );

  return (
    <div className="grid grid-flow-row gap-3">
      <InfoCard
        title="Region"
        value={project.region.name}
        layout={layout}
        customValue={
          isRegionAvailable && (
            <div className="grid grid-flow-col items-center gap-1 self-center">
              <Image
                src={`/assets/flags/${project.region.countryCode}.svg`}
                alt={`Logo of ${project.region.countryCode}`}
                width={16}
                height={12}
              />

              <span className="truncate font-medium text-sm">
                {project.region.city} ({project.region.name})
              </span>
            </div>
          )
        }
        disableCopy={!isRegionAvailable}
      />

      <InfoCard title="Subdomain" value={project.subdomain} layout={layout} />
    </div>
  );
}
