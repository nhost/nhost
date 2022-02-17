import AnchorLink from '@/components/AnchorLink'
import CodeComponent from '@/components/MDX/CodeComponent'
import Text from '@/components/ui/Text'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import Command from '../Command'
import Divider from '../Divider'

function Note({ children }) {
  return (
    <div className="px-5 py-5 my-5 space-y-2 text-white rounded-md bg-verydark">
      <Text className="text-white">Note</Text>
      <Text className="text-white">{children}</Text>
    </div>
  )
}

function Video({ src }) {
  return (
    <div className="flex justify-center mx-10 my-8">
      <video width="800" controls>
        <source src={src} type="video/mp4" />
      </video>
    </div>
  )
}

const CustomLink = (props) => {
  const href = props.href
  const isInternalLink = href && (href.startsWith('/') || href.startsWith('#'))

  if (isInternalLink) {
    return (
      <Link href={href}>
        <a {...props} className="font-medium text-blue">
          {props.children}
        </a>
      </Link>
    )
  }

  return (
    <a target="_blank" className="font-medium text-blue" rel="noopener noreferrer" {...props} />
  )
}

const components = {
  img: (props) => {
    return (
      <>
        <span className="block mx-10 mt-5 ">
          <img src={props.src} alt={props.alt} className="mx-auto mt-2 border" />
          {props.alt && (
            <div className="block pt-4 mb-8 text-sm text-center text-secondary">
              <Text color="greyscaleDark" size="tiny">
                {props.alt}
              </Text>
            </div>
          )}
        </span>
      </>
    )
  },
  Video,
  Image,
  Text,
  Note,
  code: (props) => {
    if (props.className && props.className.includes('language')) {
      return <CodeComponent {...props} />
    } else {
      return <Command>{props.children}</Command>
    }
  },
  Divider,
  a: CustomLink,
  h1: (props) => {
    return (
      <>
        <Divider />
        <AnchorLink {...props} size="heading" className="cursor-pointer" />
      </>
    )
  },
  h2: (props) => {
    return (
      <>
        <div className="mt-10">
          <AnchorLink {...props} size="big" className="cursor-pointer" />
        </div>
      </>
    )
  },
  h3: (props) => {
    return (
      <>
        <div className="mt-8">
          <AnchorLink {...props} size="large" className="cursor-pointer" />
        </div>
      </>
    )
  },
  h4: (props) => {
    return (
      <>
        <div className="mt-4">
          <AnchorLink {...props} size="normal" className="font-bold cursor-pointer" />
        </div>
      </>
    )
  },
  p: (props) => (
    <Text
      variant="body"
      size="small"
      color="dark"
      className="my-2 antialiased leading-6"
      {...props}
    />
  ),
  Mermaid: ({ chart }) => (chart ? <div className="mermaid">{chart}</div> : null)
}

export default components
