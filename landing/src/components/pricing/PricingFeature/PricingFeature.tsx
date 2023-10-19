import { TickIcon } from '@/components/common/icons/TickIcon'
import { XIcon } from '@/components/common/icons/XIcon'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface SubFeature {
  title: string
  enabled?: boolean
}

interface PricingFeatureProps {
  feature: string
  featureIcon: ReactNode
  subFeatures: SubFeature[]
}

export default function PricingFeature({
  feature,
  featureIcon,
  subFeatures,
}: PricingFeatureProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center space-x-4">
        {featureIcon}
        <span className="text-lg">{feature}</span>
      </div>

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
          </div>
        ))}
      </div>
    </div>
  )
}
