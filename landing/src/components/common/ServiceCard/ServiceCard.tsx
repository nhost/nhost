import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { CardProps } from '../Card'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { Link } from '../Link'
import { ProductIcon } from '../ProductIcon'

export interface ServiceCardProps extends CardProps {
  /**
   * The icon to display in the card.
   */
  icon: ReactNode
  /**
   * The title of the card.
   */
  title: string
  /**
   * The description of the card.
   */
  description: string
  /**
   * The href of the card.
   */
  href: string
}

export default function ServiceCard({
  icon,
  title,
  description,
  href,
  className,
  ...props
}: ServiceCardProps) {
  return (
    <Card
      className={twMerge('grid grid-flow-row content-between gap-6', className)}
      {...props}
    >
      <ProductIcon>{icon}</ProductIcon>

      <div className="grid grid-flow-row gap-2">
        <p className="font-mona text-base font-bold text-white">{title}</p>
        <p className="text-base text-white text-opacity-65">{description}</p>
      </div>

      <Link className="text-base font-bold text-opacity-100" href={href}>
        Learn more <ArrowRightIcon />
      </Link>
    </Card>
  )
}
