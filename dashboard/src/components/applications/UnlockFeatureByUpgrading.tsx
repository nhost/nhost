import { ChangePlanModal } from '@/components/applications/ChangePlanModal';
import { useDialog } from '@/components/common/DialogProvider';
import { useIsCurrentUserOwner } from '@/features/projects/common/useIsCurrentUserOwner';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface UnlockFeatureByUpgradingProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Message to display in the alert.
   */
  message: string;
}

export function UnlockFeatureByUpgrading({
  message,
  className,
  ...props
}: UnlockFeatureByUpgradingProps) {
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
