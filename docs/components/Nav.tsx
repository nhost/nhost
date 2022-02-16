import Text from '@/components/ui/Text'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { fixTitle } from '../utils/fixTitle'

export function Nav(props) {
  const router = useRouter()
  return (
    <div className="hidden lg:flex lg:min-w-nav lg:w-nav flex-col space-y-5 antialiased mt-1">
      <div>
        <ul>
          <Link href={`/${props.category}`} passHref>
            <li
              className={clsx(
                'cursor-pointer py-1 px-3 transition duration-300 ease-in-out rounded-md hover:text-black hover:bg-veryLightGray',
                router.query.category === props.category &&
                  !router.query.subcategory &&
                  !router.query.post &&
                  'bg-veryLightGray'
              )}
            >
              <Text
                variant="a"
                color="greyscaleDark"
                size="normal"
                className={clsx(
                  'transition-colors duration-300 ease-in-out text-greyscaleDark hover:text-dark subpixel-antialiased',
                  'font-medium'
                )}
              >
                {props.categoryTitle}
              </Text>
            </li>
          </Link>
        </ul>
      </div>
      {props.convolutedNav.map((elem) => {
        return (
          <div key={elem.category}>
            <Link href={`/${props.category.replace(' ', '-')}/${elem.category}/`} passHref>
              <Text
                variant="a"
                color="greyscaleGrey"
                size="normal"
                className="font-medium capitalize px-3 py-px block"
              >
                {/* Split */}
                {fixTitle(elem)}
              </Text>
            </Link>

            <ul className="space-y-1 mt-1 ">
              {elem.posts.map((post) => {
                const pathToLink =
                  post.fileName != 'index'
                    ? `${props.pathname}/${elem.category}/${post.fileName}`
                    : `${props.pathname}/${elem.category}`

                const shouldHighlight =
                  router.query.subcategory === elem.category && props.query.post === post.fileName

                const shouldHighlightSubcategories =
                  !router.query.post &&
                  post.fileName === 'index' &&
                  elem.category === router.query.subcategory

                return (
                  <Link href={pathToLink} passHref key={pathToLink}>
                    <li
                      className={clsx(
                        'cursor-pointer py-1 px-3 transition duration-300 ease-in-out rounded-md hover:text-black hover:bg-veryLightGray',
                        (shouldHighlight || shouldHighlightSubcategories) && 'bg-veryLightGray'
                      )}
                    >
                      <Text
                        variant="a"
                        color="greyscaleDark"
                        size="normal"
                        className={clsx(
                          'transition-colors duration-300 ease-in-out text-greyscaleDark hover:text-dark subpixel-antialiased',
                          (shouldHighlight || shouldHighlightSubcategories) && 'font-medium'
                        )}
                      >
                        {post.title}
                      </Text>
                    </li>
                  </Link>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
