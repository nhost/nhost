import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import type { ConfigRunServicePort } from '@/utils/__generated__/graphql';

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

  const getPortURL = (_port: string | number) => {
    const port = Number(_port) > 0 ? Number(_port) : '[port]';

    return `https://${subdomain}-${port}.svc.${currentProject?.region.awsName}.${currentProject?.region.domain}`;
  };

  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <div className="flex flex-col gap-2">
        <Text color="secondary">Private registry</Text>
        <InfoCard
          title=""
          value={`registry.${currentProject.region.awsName}.${currentProject.region.domain}/${serviceID}`}
        />
      </div>

      {ports?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text color="secondary">Ports</Text>
          {ports
            .filter((port) => port.publish)
            .map((port) => (
              <InfoCard
                title={`${port.type}:${port.port}`}
                value={getPortURL(port.port)}
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
