import markdownStyles from '@/styles/markdown-styles.module.css'
import { DOCS_GITHUB_ENDPOINT } from '@/utils/constants'
import { MDXRemote } from 'next-mdx-remote'
import { useRouter } from 'next/dist/client/router'
import React from 'react'

import GithubIcon from './icons/GithubIcon'
import Button from './ui/Button/Button'
import Text from './ui/Text/Text'

function getGithubLink(category, subcategory, post) {
  if (post) return `${DOCS_GITHUB_ENDPOINT}${category}/${subcategory}/${post}.mdx`
  else if (subcategory) return `${DOCS_GITHUB_ENDPOINT}${category}/${subcategory}/index.mdx`
  else {
    return `${DOCS_GITHUB_ENDPOINT}${category}/index.mdx`
  }
}

export function Content({ mdxSource, components, frontmatter }) {
  const router = useRouter()
  return (
    <div className="flex flex-col w-full h-full mt-2">
      <div className="flex flex-row mb-4 place-content-between">
        <Text color="greyscaleDark" className="font-medium cursor-pointer" size="heading">
          {frontmatter.title}
        </Text>
        <div className="self-center hidden md:block">
          <Button
            Component="a"
            variant="secondary"
            className="invisible md:visible"
            href={getGithubLink(router.query.category, router.query.subcategory, router.query.post)}
            target="_blank"
            rel="noreferrer"
          >
            Edit This Page
            <GithubIcon className="w-3.5 h-3.5 ml-1.5 text-greyscaleDark self-center" />
          </Button>
        </div>
      </div>
      <div className={markdownStyles['markdown']}>
        <MDXRemote {...mdxSource} components={components} lazy />
      </div>
    </div>
  )
}
