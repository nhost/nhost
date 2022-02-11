import Text from '@/components/ui/Text'
import React from 'react'

import Github from '@/components/icons/Github'
import { DOCS_GITHUB_ENDPOINT } from '@/utils/constants'

export function PostMetadata(props) {
  return (
    <div className="mt-3 flex flex-row border-t pt-6 place-content-between px-3">
      <div className="flex flex-row">
        <Github className="text-blue" />
        <a
          className="text-blue text-xs ml-2 self-center"
          href={`${DOCS_GITHUB_ENDPOINT}${props.category}/${props.subcategory}/${props.post}.mdx`}
          target="_blank"
          rel="noreferrer"
        >
          Edit this page on GitHub
        </a>
      </div>
      <div>
        {props.frontmatter.updatedAt ? (
          <div className="flex">
            <Text size="tiny">Last updated on {props.frontmatter.updatedAt}</Text>
          </div>
        ) : (
          ''
        )}
      </div>
    </div>
  )
}
