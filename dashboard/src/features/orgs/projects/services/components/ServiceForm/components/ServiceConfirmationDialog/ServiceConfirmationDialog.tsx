import { InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { COST_PER_VCPU } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';

export interface ServiceConfirmationDialogProps {
  /**
   * The updated resources that the user has selected.
   */
  formValues: ServiceFormValues;
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onCancel: () => void;
  /**
   * Function to be called when the user clicks the confirm button.
   */
  onSubmit: () => Promise<void>;
}

export default function ServiceConfirmationDialog({
  formValues,
  onCancel,
  onSubmit,
}: ServiceConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const approximatePriceForService = parseFloat(
    (formValues.compute.cpu * formValues.replicas * COST_PER_VCPU).toFixed(2),
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      <div className="grid grid-flow-row gap-4">
        <div className="grid grid-flow-row gap-1.5">
          <div className="grid grid-flow-col items-center justify-between gap-2">
            <p className="text-muted-foreground">vCPUs</p>
            <p>{formValues.compute.cpu / RESOURCE_VCPU_MULTIPLIER}</p>
          </div>

          <div className="grid grid-flow-col items-center justify-between gap-2">
            <p className="text-muted-foreground">Memory</p>
            <p>{formValues.compute.memory} MiB</p>
          </div>

          <div className="grid grid-flow-col items-center justify-between gap-2">
            <p className="text-muted-foreground">Replicas</p>
            <p>{formValues.replicas}</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-flow-col justify-between gap-2">
          <div className="grid grid-flow-col items-center gap-1.5">
            <p className="font-medium">Approximate Cost</p>

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Info" className="flex">
                  <InfoIcon className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                $0.0012/minute for every 1 vCPU and 2 GiB of RAM
              </TooltipContent>
            </Tooltip>
          </div>

          <p>${approximatePriceForService}/mo</p>
        </div>
      </div>

      <div className="grid grid-flow-row gap-2">
        <ButtonWithLoading
          loading={isSubmitting}
          onClick={handleSubmit}
          autoFocus
        >
          Confirm
        </ButtonWithLoading>

        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
