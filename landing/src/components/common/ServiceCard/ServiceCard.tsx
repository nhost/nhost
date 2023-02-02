import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { CardProps } from '../Card'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { Link } from '../Link'

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
      <div className="relative h-12 w-12">
        <div className="absolute top-px right-px bottom-px left-px z-20 flex items-center justify-center rounded-full bg-black">
          {icon}
        </div>

        <div className="radial-inner absolute top-0 bottom-0 right-0 left-0 z-0 rounded-full opacity-10"></div>
        <div className="radial-outer absolute top-0 bottom-0 right-0 left-0 z-10 rounded-full opacity-50"></div>
      </div>

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
