import { Card } from "../Card"
import { twMerge } from "tailwind-merge"
import { ProductIcon } from '../ProductIcon'

export interface SecurityCardProps {
    icon: React.ReactNode
    title: string
    content: React.ReactNode
    className?: string
}

export default function SecurityCard({ icon, title, content, className, ...props }: SecurityCardProps) {
    return (
      <Card
        className={twMerge(
          'grid grid-flow-row content-start gap-6',
          className,
        )}
        {...props}
      >
        <ProductIcon>{icon}</ProductIcon>

        <div className="grid grid-flow-row gap-2">
          <p className="font-mona text-base font-bold text-white">{title}</p>
          <div className="text-base text-white text-opacity-65">{content}</div>
        </div>
      </Card>
    )
}