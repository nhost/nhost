import InfoCard from '@/components/overview/InfoCard';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Text from '@/ui/v2/Text';
import Image from 'next/image';

export default function OverviewProjectInfo() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3" className="lg:!font-bold">
        Project Info
      </Text>

      {currentApplication && (
        <div className="grid grid-flow-row gap-3">
          <InfoCard
            title="Region"
            value={currentApplication.region?.awsName}
            customValue={
              currentApplication.region && (
                <div className="grid grid-flow-col items-center gap-1 self-center">
                  <Image
                    src={`/assets/${currentApplication.region.countryCode}.svg`}
                    alt={`Logo of ${currentApplication.region.countryCode}`}
                    width={16}
                    height={16}
                  />

                  <Text className="text-sm font-medium text-greyscaleDark">
                    {currentApplication.region.city} (
                    {currentApplication.region.awsName})
                  </Text>
                </div>
              )
            }
            disableCopy={!currentApplication.region}
          />

          <InfoCard title="Subdomain" value={currentApplication.subdomain} />
        </div>
      )}
    </div>
  );
}
