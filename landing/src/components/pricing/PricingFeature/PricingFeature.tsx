import { TickIcon } from '@/components/common/icons/TickIcon'
import { ReactNode } from 'react'

interface PricingFeatureProps {
  feature: string
  featureIcon: ReactNode
  subFeatures: string[]
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
            // todo move this color to tailwind.config.js
            className="flex flex-row items-center space-x-4 text-[#0052CD]"
          >
            <TickIcon />
            <span className="font-normal text-white text-opacity-65">
              {subFeature}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
