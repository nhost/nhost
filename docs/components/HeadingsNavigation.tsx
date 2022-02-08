import Text from '@/components/ui/Text/Text'
import createKebabCase from '@/utils/createKebabCase'
import clsx from 'clsx'
import { useRouter } from 'next/dist/client/router'
import Link from 'next/link'
import React from 'react'

export function HeadingsNavigation(props) {
  const {
    query: { category, subcategory, post }
  } = useRouter()

  return (
    <div className="hidden xl:flex flex-col mt-10 sticky top-20 w-full h-full pb-12 pl-4">
      <Text className="font-medium" color="greyscaleDark" size="normal">
        On this page
      </Text>
      <ul className="space-y-2 mt-2 pl-1">
        {props.headings.map((heading) => {
          return (
            <Link
              passHref
              key={heading.name}
              href={`/${category}/${subcategory}/${post}#${createKebabCase(heading.name)}`}
            >
              <li
                className={clsx(
                  'text-blue hover:text-darkBlue transition-all duration-300  cursor-pointer hover:translate-x-0.5 transform',
                  heading.depth === 1 && 'text-sm font-medium',
                  heading.depth === 2 && 'pl-3 text-sm font-normal',
                  heading.depth === 3 && 'pl-7 text-xs font-normal'
                )}
              >
                {heading.name}
              </li>
            </Link>
          )
        })}
      </ul>
    </div>
  )
}
