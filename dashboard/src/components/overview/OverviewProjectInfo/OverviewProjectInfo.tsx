import InfoCard from '@/components/overview/InfoCard';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Text from '@/ui/v2/Text';
import Image from 'next/image';

export default function OverviewProjectInfo() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { region, subdomain } = currentApplication || {};
  const isRegionAvailable =
    region?.awsName && region?.countryCode && region?.city;

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Info</Text>

      {currentApplication && (
        <div className="grid grid-flow-row gap-3">
          <InfoCard
            title="Region"
            value={region?.awsName}
            customValue={
              region.countryCode &&
              region.city && (
                <div className="grid grid-flow-col items-center gap-1 self-center">
                  <Image
                    src={`/assets/flags/${region.countryCode}.svg`}
                    alt={`Logo of ${region.countryCode}`}
                    width={16}
                    height={12}
                  />

                  <Text className="text-sm font-medium truncate">
                    {region.city} ({region.awsName})
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
