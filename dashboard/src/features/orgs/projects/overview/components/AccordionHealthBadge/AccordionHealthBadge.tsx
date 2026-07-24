import { Box } from '@/components/ui/v2/Box';
import { ProjectHealthCheckIcon } from '@/components/ui/v3/icons/ProjectHealthCheckIcon';
import { QuestionMarkIcon } from '@/components/ui/v3/icons/QuestionMarkIcon';
import { serviceStateToThemeColor } from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/generated/graphql';

interface AccordionHealthBadgeProps {
  serviceState?: ServiceState;
  unknownState?: boolean;
  /*
   * Blinking animation to indicate that the service is updating.
   */
  blink?: boolean;
}

export default function AccordionHealthBadge({
  serviceState,
  unknownState,
  blink,
}: AccordionHealthBadgeProps) {
  if (unknownState) {
    return (
      <Box
        sx={{
          backgroundColor: serviceStateToThemeColor.get(serviceState),
        }}
        className="flex h-2.5 w-2.5 items-center justify-center rounded-full"
      >
        <QuestionMarkIcon className="h-3/4 w-3/4 stroke-2 text-[#F5F5F5] dark:text-[#21262D]" />
      </Box>
    );
  }

  if (serviceState === ServiceState.Running) {
    return (
      <Box
        sx={{
          backgroundColor: serviceStateToThemeColor.get(serviceState),
        }}
        className="flex h-2.5 w-2.5 items-center justify-center rounded-full"
      >
        <ProjectHealthCheckIcon className="h-3/4 w-3/4 text-[#F5F5F5] dark:text-[#21262D]" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        backgroundColor: serviceStateToThemeColor.get(serviceState),
      }}
      className={`h-2.5 w-2.5 rounded-full ${blink ? 'animate-pulse' : ''}`}
    />
  );
}
