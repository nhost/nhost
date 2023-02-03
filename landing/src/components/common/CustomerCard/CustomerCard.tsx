import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { CardProps } from '../Card'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { LineGrid } from '../LineGrid'
import { Link } from '../Link'

export interface CustomerCardProps extends CardProps {
  /**
   * The image to display in the card.
   */
  image: ReactNode
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

export default function CustomerCard({
  image,
  title,
  description,
  href,
  className,
  ...props
}: CustomerCardProps) {
  return (
    <Card className={twMerge('p-0', className)} {...props}>
      <div className="relative z-0 h-52 overflow-hidden px-12 pt-12">
        <div className="bg-glow-gradient absolute top-0 left-0 right-0 bottom-0 h-full w-full blur-[80px]" />
        <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-10 h-full w-full" />
        <LineGrid className="left-0 right-0 bottom-0 top-0 z-10 translate-x-0 scale-100" />
        <div className="relative z-20 flex h-full w-full items-center justify-center rounded-t-[4px] bg-black bg-opacity-80">
          {image}

          <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-30 h-full w-full" />
        </div>
      </div>

      <div className="relative z-10 grid grid-flow-row gap-6 px-8 pb-8 pt-2.5">
        <div className="grid grid-flow-row gap-2">
          <p className="font-mona text-base font-bold text-white">{title}</p>
          <p className="text-base text-white text-opacity-65">{description}</p>
        </div>

        <Link
          className="text-base font-bold text-opacity-100 hover:underline"
          href={href}
        >
          Read the story <ArrowRightIcon />
        </Link>
      </div>
    </Card>
  )
}
