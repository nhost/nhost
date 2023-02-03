import { Author } from '@/utils/types'
import { format, parseISO } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { CardProps } from '../Card'
import { LineGrid } from '../LineGrid'

export interface BlogPostCardProps extends CardProps {
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
  /**
   * Tags of the blog post.
   */
  tags?: string[]
  /**
   * Authors of the blog post.
   */
  authors?: Author[]
  /**
   * Date of the blog post.
   */
  date: string
  /**
   * Determines whether or not the blog post is highlighted.
   */
  highlighted?: boolean
}

export default function BlogPostCard({
  image,
  title,
  description,
  href,
  className,
  tags,
  authors,
  date,
  highlighted,
  ...props
}: BlogPostCardProps) {
  return (
    <Link
      className="text-base font-normal text-opacity-100 hover:no-underline"
      href={href}
    >
      <Card className={twMerge('border-none p-0', className)} {...props}>
        <div className="relative z-0 overflow-hidden rounded-xl border border-divider px-12 pt-12">
          <div className="bg-glow-gradient absolute top-0 left-0 right-0 bottom-0 h-full w-full blur-[80px]" />
          <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-10 h-full w-full" />
          <LineGrid
            className={twMerge(
              'left-0 right-0 bottom-0 top-0 z-10',
              highlighted && 'md:-translate-x-14 md:scale-125',
            )}
            slotProps={{
              image: {
                priority: true,
                className: 'opacity-100 object-right-bottom',
              },
            }}
          />
          <div className="relative z-20 flex h-full items-center justify-center overflow-hidden rounded-t-[4px] border-divider border-opacity-50 bg-black bg-opacity-80 shadow-cover">
            {image}

            <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-30 h-full w-full" />
          </div>
        </div>

        {tags && (
          <p className="mt-6 text-sm text-white text-opacity-65">
            {tags.join(' · ')}
          </p>
        )}

        <div className="relative z-10 mt-4 grid grid-flow-row gap-6">
          <div className="grid max-w-2xl grid-flow-row gap-2">
            <p className="font-mona text-xl text-white">{title}</p>
            <p className="text-base text-white text-opacity-65">
              {description}
            </p>
          </div>
        </div>

        {authors && (
          <div className="mt-4 grid grid-flow-col items-center justify-start gap-3 text-sm font-medium text-white text-opacity-65">
            {authors.map((author, index) => (
              <div
                className={twMerge(
                  'grid grid-flow-col items-center gap-2',
                  authors.length > 0 && index > 0 && '-ml-6',
                )}
                key={author.name}
              >
                <Image
                  src={author.avatarUrl}
                  alt={`Avatar of ${author.name}`}
                  width={24}
                  height={24}
                  className="rounded-full"
                />

                {authors.length === 1 && (
                  <span className="text-sm text-white text-opacity-100">
                    {author.name}
                  </span>
                )}
              </div>
            ))}{' '}
            | <span>{format(parseISO(date), 'd MMMM yyyy')}</span>
          </div>
        )}
      </Card>
    </Link>
  )
}
