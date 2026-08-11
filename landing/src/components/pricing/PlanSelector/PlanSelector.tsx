import { Button } from '@/components/common/Button'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'
import { ForwardedRef, forwardRef } from 'react'

export interface PlanSelectorProps {
  /**
   * Callback function that is called when a plan is selected
   */
  onSelect: (plan: 'starter' | 'pro' | 'enterprise') => void
  /**
   * Callback function that is called when the modal is closed
   */
  onClose: VoidFunction
  /**
   * The currently selected plan
   */
  selectedPlan: 'starter' | 'pro' | 'enterprise'
}

function PlanSelector(
  { onSelect, onClose, selectedPlan }: PlanSelectorProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      className="fixed top-0 bottom-0 left-0 right-0 z-50 h-full w-full bg-black bg-opacity-[1%] backdrop-blur-md lg:hidden"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 right-0 left-0 grid w-full grid-flow-row gap-2 rounded-t-lg border border-divider bg-black p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="borderless"
          className="justify-between font-mona text-2xl"
          size="sm"
          onClick={() => {
            onSelect('starter')
            onClose()
          }}
        >
          Starter {selectedPlan === 'starter' && <CheckmarkCircleIcon />}
        </Button>
        <div className="h-px w-full bg-divider" />
        <Button
          variant="borderless"
          className="justify-between font-mona text-2xl"
          size="sm"
          onClick={() => {
            onSelect('pro')
            onClose()
          }}
        >
          Pro {selectedPlan === 'pro' && <CheckmarkCircleIcon />}
        </Button>
        <div className="h-px w-full bg-divider" />
        <Button
          variant="borderless"
          className="justify-between font-mona text-2xl"
          size="sm"
          onClick={() => {
            onSelect('enterprise')
            onClose()
          }}
        >
          Enterprise {selectedPlan === 'enterprise' && <CheckmarkCircleIcon />}
        </Button>
      </div>
    </div>
  )
}

export default forwardRef(PlanSelector)
