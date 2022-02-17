import AnchorLink, { AnchorLinkProps } from '@/components/AnchorLink'
import CodeComponent, { CodeEditorProps } from '@/components/MDX/CodeComponent'
import Text, { TextProps } from '@/components/ui/Text'
import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import React, { DetailedHTMLProps, HTMLProps, PropsWithChildren } from 'react'

import Command from '../Command'
import Divider from '../Divider'

function Note({ children }: PropsWithChildren<unknown>) {
  return (
    <div className="px-5 py-5 my-5 space-y-2 text-white rounded-md bg-verydark">
      <Text className="text-white">Note</Text>
      <Text className="text-white">{children}</Text>
    </div>
  )
}

function Video({
  src,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLSourceElement>, HTMLSourceElement>) {
  return (
    <div className="flex justify-center my-8 mx-10">
      <video width="800" controls>
        <source src={src} type="video/mp4" {...props} />
      </video>
    </div>
  )
}

const CustomLink = ({
  className,
  children,
  href,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLAnchorElement>, HTMLAnchorElement>) => {
  const isInternalLink = href && (href.startsWith('/') || href.startsWith('#'))

  if (isInternalLink) {
    return (
      <Link href={href} passHref>
        <a className={clsx('font-medium text-blue', className)} {...props}>
          {children}
        </a>
      </Link>
    )
  }

  return (
    <a
      target="_blank"
      className={clsx('font-medium text-blue', className)}
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  )
}

const components = {
  img: (props: DetailedHTMLProps<HTMLProps<HTMLImageElement>, HTMLImageElement>) => {
    return (
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
    )
  },
  Video,
  Image,
  Text,
  Note,
  code: (props: CodeEditorProps) => {
    if (props.className && props.className.includes('language')) {
      return <CodeComponent {...props} />
    } else {
      return <Command>{props.children}</Command>
    }
  },
  Divider,
  a: CustomLink,
  h1: (props: AnchorLinkProps) => {
    return (
      <>
        <Divider />
        <AnchorLink {...props} className="cursor-pointer text-3xl md:text-4xl" />
      </>
    )
  },
  h2: (props: AnchorLinkProps) => {
    return (
      <div className="mt-10">
        <AnchorLink {...props} className="cursor-pointer text-lg sm:text-xl md:text-2.5xl" />
      </div>
    )
  },
  h3: (props: AnchorLinkProps) => {
    return (
      <div className="mt-8">
        <AnchorLink {...props} className="cursor-pointer text-lg" />
      </div>
    )
  },
  h4: (props: AnchorLinkProps) => {
    return (
      <div className="mt-4">
        <AnchorLink {...props} className="font-bold cursor-pointer text-base-" />
      </div>
    )
  },
  p: (props: TextProps) => {
    return (
      <Text
        variant="body"
        size="small"
        color="dark"
        className="my-2 antialiased leading-6"
        {...props}
      />
    )
  }
}

export default components
