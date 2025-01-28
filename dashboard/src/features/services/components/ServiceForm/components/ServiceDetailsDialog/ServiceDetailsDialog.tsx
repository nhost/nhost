import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import type { ConfigRunServicePort } from '@/utils/__generated__/graphql';
import { getRunServicePortURL } from '@/utils/helpers';

export interface ServiceDetailsDialogProps {
  /**
   * The id of the service
   */
  serviceID: string;

  /**
   * The subdomain of the service
   */
  subdomain: string;

  /**
   * The service ports
   * We use partial here because `port` is set as required in ConfigRunServicePort
   */
  ports: Partial<ConfigRunServicePort>[];
}

export default function ServiceDetailsDialog({
  serviceID,
  subdomain,
  ports,
}: ServiceDetailsDialogProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { closeDialog } = useDialog();

  const publishedPorts = ports.filter((port) => port.publish);

  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <div className="flex flex-col gap-2">
        <Text color="secondary">Private registry</Text>
        <InfoCard
          title=""
          value={`registry.${currentProject.region.name}.${currentProject.region.domain}/${serviceID}`}
        />
      </div>

      {publishedPorts?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text color="secondary">Ports</Text>
          {publishedPorts.map((port) => (
            <InfoCard
              key={String(port.port)}
              title={`${port.type} <--> ${port.port}`}
              value={getRunServicePortURL(
                subdomain,
                currentProject?.region.name,
                currentProject?.region.domain,
                port,
              )}
            />
          ))}
        </div>
      )}

      <Button
        className="w-full"
        color="primary"
        onClick={() => closeDialog()}
        autoFocus
      >
        OK
      </Button>
    </div>
  );
}
