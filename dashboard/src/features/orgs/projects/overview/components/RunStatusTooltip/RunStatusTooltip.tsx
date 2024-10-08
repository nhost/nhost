import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import {
  serviceStateToThemeColor,
  type baseServices,
  type ServiceHealthInfo,
} from '@/features/projects/overview/health';
import { ServiceState } from '@/generated/graphql';

export interface RunStatusTooltipProps {
  servicesStatusInfo?: Array<ServiceHealthInfo>;
  openHealthModal?: (
    defaultExpanded?: keyof typeof baseServices | 'run',
  ) => void;
}

export default function RunStatusTooltip({
  servicesStatusInfo,
  openHealthModal,
}: RunStatusTooltipProps) {
  return (
    <div className="flex w-full flex-col gap-3 px-2 py-3">
      <ol className="m-0 flex flex-col gap-3">
        {servicesStatusInfo.map((service) => (
          <li
            key={service.name}
            className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5"
          >
            <Box
              sx={{
                backgroundColor: serviceStateToThemeColor.get(service.state),
              }}
              className={`h-3 w-3 flex-shrink-0 rounded-full ${
                service.state === ServiceState.Updating ? 'animate-pulse' : ''
              }`}
            />
            <Text
              sx={{
                color: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'text.primary'
                    : 'text.primary',
              }}
              className="font-semibold"
            >
              {service.name}
            </Text>
          </li>
        ))}
      </ol>
      <Button variant="outlined" onClick={() => openHealthModal('run')}>
        View state
      </Button>
    </div>
  );
}
