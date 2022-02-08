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
        <span className="block mt-5 mx-10 ">
          <img src={props.src} alt={props.alt} className="mx-auto border mt-2" />
          {props.alt && (
            <div className="block text-center text-secondary text-sm mb-8 pt-4">
              <Text color="greyscaleDark" size="tiny">
                {props.alt}
              </Text>
            </div>
          )}
        </span>
      </>
    )
  },
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
  )
}

export default components
