import Text from '@/components/ui/Text'
import { motion } from 'framer-motion'
import { useRouter } from 'next/dist/client/router'
import React, { useState } from 'react'
import createKebabCase from '../utils/createKebabCase'
import Permalink from './icons/Permalink'

export interface AnchorLinkProps {
  children?: any
  id?: string
  size?: 'tiny' | 'small' | 'normal' | 'large' | 'big' | 'heading'
  className?: string
}

export default function AnchorLink({ children, id, size, className }: AnchorLinkProps) {
  const {
    query: { category, subcategory, post }
  } = useRouter()
  const [showPermaLink, setShowPermalink] = useState(false)

  const isQuoted = typeof children !== 'string'

  return (
    <div
      id={
        id
          ? children.split('/')[1]
          : createKebabCase(
              `#${isQuoted ? (children.props ? children.props.children : children) : children}`
            )
      }
      className={className}
      onMouseOver={() => setShowPermalink(true)}
      onMouseLeave={() => setShowPermalink(false)}
    >
      <span id={createKebabCase(`${children}`)} className={'flex flex-row relative'}>
        {showPermaLink ? (
          <motion.span
            className="absolute self-center w-4 h-4 align-middle -left-5"
            onClick={() => {
              navigator.clipboard
                .writeText(
                  `https://docs.nhost.io/${category}/${subcategory}/${post}/${
                    id
                      ? id
                      : createKebabCase(
                          `#${
                            isQuoted
                              ? children.props
                                ? children.props.children
                                : children
                              : children
                          }`
                        )
                  }`
                )
                .catch((e) => {
                  // eslint-disable-next-line no-console
                  console.log(e)
                })
            }}
          >
            <Permalink className="w-4 h-4" />
          </motion.span>
        ) : (
          <></>
        )}
        <Text
          variant="a"
          href={createKebabCase(
            `#${isQuoted ? (children.props ? children.props.children : children) : children}`
          )}
          color="greyscaleDark"
          className="font-medium break-all"
        >
          {children}
        </Text>
      </span>
    </div>
  )
}
