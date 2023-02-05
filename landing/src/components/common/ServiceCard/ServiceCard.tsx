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
  /**
   * Determines whether the link should be disabled.
   */
  disableLink?: boolean
}

export default function ServiceCard({
  icon,
  title,
  description,
  href,
  className,
  disableLink,
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

      {!disableLink ? (
        <Link
          className="justify-self-start text-base font-bold text-opacity-100"
          href={href}
        >
          Learn more <ArrowRightIcon />
        </Link>
      ) : (
        <span className="text-base font-bold">You are here</span>
      )}
    </Card>
  )
}
