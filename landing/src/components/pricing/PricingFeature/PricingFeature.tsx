import { TickIcon } from '@/components/common/icons/TickIcon'
import { XIcon } from '@/components/common/icons/XIcon'
import { ReactNode } from 'react'

interface SubFeature {
  enabled?: boolean
  title: string
  tooltip?: ReactNode
}

interface PricingFeatureProps {
  subFeatures: SubFeature[]
}

export default function PricingFeature({ subFeatures }: PricingFeatureProps) {
  return (
    <div className="space-y-2 pl-[2.8rem]">
      {subFeatures.map((subFeature, index) => (
        <div
          key={String(index)}
          className="flex flex-row items-center space-x-4 text-brand-main"
        >
          <div>
            {subFeature.enabled === false ? (
              <XIcon className="h-4 w-4 text-white" />
            ) : (
              <TickIcon />
            )}
          </div>
          <span className="font-normal text-white text-opacity-65">
            {subFeature.title}{' '}
            {subFeature.enabled === false && '(not available)'}
          </span>
          {subFeature.tooltip}
        </div>
      ))}
    </div>
  )
}
