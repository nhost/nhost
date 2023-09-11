import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import { useGetRunServiceQuery } from '@/utils/__generated__/graphql';

export interface ServiceDetailsDialogProps {
  /**
   * The id of the service to show details for
   */
  serviceID: string;
}

export default function ServiceDetailsDialog({
  serviceID,
}: ServiceDetailsDialogProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { closeDialog } = useDialog();

  const { data, loading } = useGetRunServiceQuery({
    variables: {
      id: serviceID,
      resolve: false,
    },
  });

  const getPortURL = (_port: string | number, subdomain: string) => {
    const port = Number(_port) > 0 ? Number(_port) : '[port]';

    return `https://${subdomain}-${port}.svc.${currentProject?.region.awsName}.${currentProject?.region.domain}`;
  };

  if (loading) {
    <ActivityIndicator
      delay={500}
      className="mx-auto"
      label="Loading preview..."
    />;
  }

  const image = data?.runService?.config?.image?.image || '';
  const ports = data?.runService?.config?.ports || [];
  const subdomain = data?.runService?.subdomain || '';

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      <Box className="grid grid-flow-row gap-4">
        <Box className="grid grid-flow-row gap-1.5">
          <Box className="grid grid-flow-col items-center justify-between gap-2">
            <Box className="grid grid-flow-row gap-0.5">
              <Text color="secondary">Private registry</Text>
            </Box>
            {image && (
              <InfoCard
                title="Private registry"
                value={`registry.${currentProject.region.awsName}.${currentProject.region.domain}/${serviceID}`}
              />
            )}
          </Box>
        </Box>

        <Divider />

        {ports
          .filter((port) => port.publish)
          .map((port) => (
            <Box
              key={String(port.port)}
              className="grid grid-flow-col justify-between gap-2"
            >
              <Box className="grid grid-flow-col items-center gap-1.5">
                <Text className="font-medium">{port.type}</Text>

                <Tooltip title="$0.0012/minute for every 1 vCPU and 2 GiB of RAM">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>

              <InfoCard title="URL" value={getPortURL(port.port, subdomain)} />
            </Box>
          ))}
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Button color="primary" onClick={() => closeDialog()} autoFocus>
          OK
        </Button>
      </Box>
    </div>
  );
}
