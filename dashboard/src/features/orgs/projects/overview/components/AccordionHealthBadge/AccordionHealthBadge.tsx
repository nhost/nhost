import { Box } from '@/components/ui/v2/Box';
import { serviceStateToThemeColor } from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/utils/__generated__/graphql';
import { Check, Help } from 'lucide-react';
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
        <QuestionMarkIcon
          sx={{
            color: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
          }}
          className="h-3/4 w-3/4 stroke-2"
        />
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
        <CheckIcon
          sx={{
            color: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
          }}
          className="h-3/4 w-3/4 stroke-2"
        />
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
