import ArrowLeft from '@/components/icons/ArrowLeft'
import ArrowRight from '@/components/icons/ArrowRight'
import Text from '@/components/ui/Text/Text'
import { orderTwo } from '@/lib/order'
import { useRouter } from 'next/dist/client/router'
import Link from 'next/link'
import React from 'react'

export function SubNavigation({ category, subcategory, post, convolutedNav }) {
  const router = useRouter()
  const indexOfSubcategory = Object.keys(orderTwo[category]).indexOf(subcategory)
  const indexOfPreviousPost = orderTwo[category][subcategory].indexOf(post) - 1
  let indexOfCurrentPost = orderTwo[category][subcategory].indexOf(post)
  const previousPost = orderTwo[category][subcategory][indexOfCurrentPost - 1]
  let indexOfNextPost = orderTwo[category][subcategory].indexOf(post) + 1

  if (!router.query.post) indexOfCurrentPost++ && indexOfNextPost++

  const nextPost = orderTwo[category][subcategory][indexOfCurrentPost + 1]

  const pathLink = `/${category}/${subcategory}/${previousPost === 'index' ? '' : previousPost}`

  return (
    <div className="flex flex-row mt-10 place-content-between px-2 antialiased">
      <Link href={pathLink} passHref>
        <Text variant="a" color="blue" className="font-medium cursor-pointer" size="small">
          {indexOfCurrentPost === 0 || !router.query.post ? (
            <></>
          ) : (
            <div className="flex flex-row self-center hover:-translate-x-1 transform transition-transform duration-500">
              <ArrowLeft className="self-center mr-1" />
              {convolutedNav[indexOfSubcategory].posts[indexOfPreviousPost].title}
            </div>
          )}
        </Text>
      </Link>

      <Link href={`/${category}/${subcategory}/${nextPost}`} passHref>
        <Text variant="a" size="small" color="blue" className="font-medium cursor-pointer">
          {nextPost ? (
            <div className="flex flex-row self-center hover:translate-x-1 transform transition-transform duration-500">
              {convolutedNav[indexOfSubcategory].posts[indexOfNextPost].title}
              <ArrowRight className="self-center ml-1" />
            </div>
          ) : (
            <></>
          )}
        </Text>
      </Link>
    </div>
  )
}
