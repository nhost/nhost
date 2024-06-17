import { ServiceState } from '@/utils/__generated__/graphql';
import { Text } from '@/components/ui/v2/Text';
import { useTheme } from '@mui/material';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import type { baseServices } from '@/features/projects/overview/health';

interface ServiceVersionTooltipProps {
  serviceName?: string,
  serviceKey?: keyof typeof baseServices,
  usedVersion?: string,
  recommendedVersionMismatch?: boolean,
  recommendedVersions?: string[],
  children?: React.ReactNode
  openHealthModal?: (defaultExpanded?: keyof typeof baseServices | "run") => void
  state?: ServiceState;
}

function ServiceVersionTooltip({ serviceName, usedVersion,
  recommendedVersionMismatch, recommendedVersions,
  children, openHealthModal, state, serviceKey }: ServiceVersionTooltipProps) {
  const theme = useTheme();

  let showErrorMessage = false;
  if (state === ServiceState.Error
    || state === ServiceState.UpdateError
    || state === ServiceState.None
  ) {
    showErrorMessage = true;
  }

  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      <div className="flex flex-row justify-between gap-6">
        <Text sx={{
          color: theme.palette.mode === "dark" ? "text.secondary" : "text.secondary"
        }} variant="h4" component="p" className="text-sm+" >service</Text>
        <Text
          sx={{
            color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
          }}
          variant="h4" component="p" className="text-sm+ font-semibold">{serviceName}</Text>
      </div>
      <div className="flex flex-row justify-between gap-6">
        <Text
          sx={{
            color: theme.palette.mode === "dark" ? "text.secondary" : "text.secondary"
          }}
          variant="h4" component="p" className="text-sm+" >version</Text>
        <Text sx={{
          color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
        }}
          variant="h4" component="p" className="font-bold text-sm+">{usedVersion}</Text>
      </div>
      {recommendedVersionMismatch && <Box sx={{ backgroundColor: theme.palette.mode === "dark" ? "grey.200" : "grey.300" }} className="rounded-md p-2">
        <Text
          sx={{
            color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
          }}
          variant="body1" component="p" className="text-sm+">
          {serviceName} is not using a recommended version. Recommended version(s):
        </Text>
        <ul className="list-disc text-sm+">
          {recommendedVersions.map(version => (
            <li className="ml-6 list-item" key={version}>
              <Text
                sx={{
                  color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
                }}
                variant="body1" component="p">
                {version}
              </Text>
            </li>
          ))}
        </ul>
      </Box>}
      {showErrorMessage
        ? <Box sx={{
          backgroundColor: theme.palette.mode === "dark" ? "error.dark" : "error.main",
        }}
          className="rounded-md p-2"
        >
          <Text variant="body1" component="p" className="text-white text-sm+ font-semibold">
            {serviceName} is offline due to errors, click on view state for further details
          </Text>
        </Box>
        : null}
      <Button
        variant="outlined"
        onClick={() => openHealthModal(serviceKey)}
      >
        View state
      </Button>
      {children}
    </div>
  )
}

export default ServiceVersionTooltip