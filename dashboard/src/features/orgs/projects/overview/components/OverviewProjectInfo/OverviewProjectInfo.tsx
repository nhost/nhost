import Image from 'next/image';
import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { InfoCard } from '@/features/orgs/projects/overview/components/InfoCard';
import { isNotEmptyValue } from '@/lib/utils';

export default function OverviewProjectInfo() {
  const { project } = useProject();
  const isRegionAvailable = !!(
    project?.region?.name &&
    project?.region?.countryCode &&
    project?.region?.city
  );

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Info</Text>

      {isNotEmptyValue(project) && (
        <div className="grid grid-flow-row gap-3">
          <InfoCard
            title="Region"
            value={project.region.name}
            customValue={
              project.region.countryCode &&
              project.region.city && (
                <div className="grid grid-flow-col items-center gap-1 self-center">
                  <Image
                    src={`/assets/flags/${project.region.countryCode}.svg`}
                    alt={`Logo of ${project.region.countryCode}`}
                    width={16}
                    height={12}
                  />

                  <Text className="truncate font-medium text-sm">
                    {project.region.city} ({project.region.name})
                  </Text>
                </div>
              )
            }
            disableCopy={!isRegionAvailable}
          />

          <InfoCard title="Subdomain" value={project.subdomain} />
        </div>
      )}
    </div>
  );
}
