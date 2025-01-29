import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import Image from 'next/image';

export default function OverviewProjectInfo() {
  const { project } = useProject();
  const { region, subdomain } = project || {};
  const isRegionAvailable = region?.name && region?.countryCode && region?.city;

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Info</Text>

      {project && (
        <div className="grid grid-flow-row gap-3">
          <InfoCard
            title="Region"
            value={region?.name}
            customValue={
              region?.countryCode &&
              region?.city && (
                <div className="grid grid-flow-col items-center gap-1 self-center">
                  <Image
                    src={`/assets/flags/${region.countryCode}.svg`}
                    alt={`Logo of ${region.countryCode}`}
                    width={16}
                    height={12}
                  />

                  <Text className="truncate text-sm font-medium">
                    {region.city} ({region.name})
                  </Text>
                </div>
              )
            }
            disableCopy={!isRegionAvailable}
          />

          <InfoCard title="Subdomain" value={subdomain} />
        </div>
      )}
    </div>
  );
}
