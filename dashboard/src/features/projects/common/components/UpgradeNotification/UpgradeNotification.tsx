import { useDialog } from '@/components/common/DialogProvider';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { ChangePlanModal } from '@/features/projects/common/components/ChangePlanModal';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface UpgradeNotificationProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Message to display in the alert.
   */
  message: string;
}

export default function UpgradeNotification({
  message,
  className,
  ...props
}: UpgradeNotificationProps) {
  const { openDialog } = useDialog();
  const isOwner = useIsCurrentUserOwner();

  return (
    <div className={twMerge('flex', className)} {...props}>
      <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
        <Text className="grid grid-flow-row justify-items-start gap-0.5">
          <Text component="span">{message}</Text>

          {!isOwner && (
            <Text component="span" color="secondary" className="text-sm">
              Ask an owner of this workspace to upgrade the project.
            </Text>
          )}
        </Text>

        {isOwner && (
          <Button
            variant="borderless"
            onClick={() => {
              openDialog({
                component: <ChangePlanModal />,
                props: {
                  PaperProps: { className: 'p-0 max-w-xl w-full' },
                },
              });
            }}
          >
            Upgrade
          </Button>
        )}
      </Alert>
    </div>
  );
}
