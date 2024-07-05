import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PowerOffIcon } from '@/components/ui/v2/icons/PowerOffIcon';
import { Text } from '@/components/ui/v2/Text';

interface ApplicationPausedReasonProps {
  isOwner?: boolean;
  freeAndLiveProjectsNumberExceeded?: boolean;
  projectName?: string;
  changingApplicationStateLoading?: boolean;
  onWakeUpClick?: () => void;
  onDeleteClick?: () => void;
  onUpgradeClick?: () => void;
}

export default function ApplicationPausedReason({
  isOwner,
  freeAndLiveProjectsNumberExceeded,
  projectName,
  changingApplicationStateLoading,
  onWakeUpClick,
  onDeleteClick,
  onUpgradeClick,
}: ApplicationPausedReasonProps) {
  return (
    <Box className="grid grid-flow-row gap-4">
      {isOwner && (
        <Button className="mx-auto w-full max-w-xs" onClick={onUpgradeClick}>
          Upgrade to Pro
        </Button>
      )}

      <div className="grid grid-flow-row gap-4">
        <Button
          variant="borderless"
          className="mx-auto w-full max-w-xs"
          loading={changingApplicationStateLoading}
          disabled={
            changingApplicationStateLoading || freeAndLiveProjectsNumberExceeded
          }
          onClick={onWakeUpClick}
        >
          Wake Up
        </Button>

        {freeAndLiveProjectsNumberExceeded && (
          <Alert severity="warning" className="mx-auto max-w-xs">
            <PowerOffIcon />
            <Text variant="h3" component="h1">
              Your project is paused
            </Text>
            <Text>
              Only 1 free project can be active at any given time. Please pause
              your active free project before unpausing {projectName}.
            </Text>
          </Alert>
        )}

        {isOwner && (
          <Button
            color="error"
            variant="outlined"
            className="mx-auto w-full max-w-xs"
            onClick={onDeleteClick}
          >
            Delete Project
          </Button>
        )}
      </div>
    </Box>
  );
}
