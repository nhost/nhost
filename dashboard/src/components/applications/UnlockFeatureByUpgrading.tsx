import { ChangePlanModal } from '@/components/applications/ChangePlanModal';
import { Alert } from '@/ui/Alert';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
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
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  return (
    <>
      <Modal
        showModal={isChangePlanModalOpen}
        close={() => setIsChangePlanModalOpen(false)}
        Component={ChangePlanModal}
      />

      <div className={twMerge('flex', className)} {...props}>
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="text-left">{message}</Text>

          <Button
            variant="borderless"
            onClick={() => setIsChangePlanModalOpen(true)}
          >
            Upgrade
          </Button>
        </Alert>
      </div>
    </>
  );
}
