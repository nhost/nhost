import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { CardProps } from '../Card'

export interface InvestorCardProps extends CardProps {
  /**
   * The avatar to display in the card.
   */
  avatar: ReactNode
  /**
   * The name of the investor.
   */
  name: string
  /**
   * The company to display (if any) in the card.
   */
  logo?: ReactNode
  /**
   * The position of the person at the company.
   */
  position?: string
}

export default function InvestorCard({
  name,
  avatar,
  logo,
  position,
  className,
  ...props
}: InvestorCardProps) {
  return (
    <Card
      className={twMerge(
        'flex max-w-[240px] flex-col items-center justify-start gap-4',
        className,
      )}
      {...props}
    >
      <div className="overflow-hidden rounded-full">{avatar}</div>

      {logo && (
        <>
          {logo}

          <div className="h-px w-12 bg-divider" />
        </>
      )}

      <div className="grid flex-auto grid-flow-row content-between gap-6">
        <p className="text-center text-base font-bold leading-relaxed">
          {name}
        </p>

        {position && (
          <p className="text-center text-white text-opacity-65">{position}</p>
        )}
      </div>
    </Card>
  )
}
