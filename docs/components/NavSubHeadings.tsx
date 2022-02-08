import React from 'react'

import AnchorLink from './AnchorLink'
import CustomLink from './CustomLink'
import createKebabCase from '../utils/createKebabCase'
import Text from '@/components/ui/Text'

export default function Nav({ headings }: { headings: any }) {
  return (
    <div className="flex flex-col space-y-5 mt-9">
      {headings.map((heading, index) => {
        return (
          <NavLink
            category={heading.category}
            post={heading.post}
            headings={heading.content}
            key={heading.category + index}
          />
        )
      })}
    </div>
  )
}

function NavLink({ category, headings, post }) {
  const href = `/${category}/${post.toLowerCase()}`
  return (
    <div className="mt-10 font-display" key={category}>
      <CustomLink href={href} activeClassName="active" key={category}>
        <Text variant="body" size="small" className="capitalize cursor-pointer text-grayscale">
          {post.split('-').join(' ')}
        </Text>
      </CustomLink>
      <ul className="space-y-1">
        {headings.map((heading: { value: string }) => {
          return (
            <li className="py-1 capitalize rounded-sm" key={heading.value}>
              <AnchorLink
                id={`/${category}/${post.toLowerCase()}#${createKebabCase(heading.value)}`}
              >{`/${heading.value}`}</AnchorLink>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
