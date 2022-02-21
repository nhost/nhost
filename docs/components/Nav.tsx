import Text from '@/components/ui/Text'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import React, { MouseEvent } from 'react'
import { fixTitle } from '../utils/fixTitle'
import { NavItem } from './NavDataContext'

export type NavProps = {
  /**
   * Class name to apply to the wrapper element.
   */
  className?: string
  /**
   * Category slug.
   */
  category: string
  /**
   * The category title.
   */
  categoryTitle: string
  /**
   * Convoluted navigation.
   */
  convolutedNav: NavItem[]
  /**
   * Function to be called when a menu item is selected.
   */
  onMenuSelected?: (event?: MouseEvent<HTMLAnchorElement, MouseEvent>) => void
}

export function Nav({ className, onMenuSelected, ...props }: NavProps) {
  const router = useRouter()

  return (
    <div className={clsx('lg:min-w-nav lg:w-nav flex-col space-y-5 antialiased mt-1', className)}>
      <div>
        <ul>
          <li
            className={clsx(
              'transition duration-300 ease-in-out rounded-md hover:text-black hover:bg-veryLightGray',
              router.query.category === props.category &&
                !router.query.subcategory &&
                !router.query.post &&
                'bg-veryLightGray'
            )}
          >
            <Link href={`/${props.category}`} passHref>
              <Text
                variant="a"
                color="greyscaleDark"
                size="normal"
                className={clsx(
                  'block py-1.5 px-3 transition-colors duration-300 ease-in-out text-greyscaleDark hover:text-dark subpixel-antialiased',
                  'font-medium'
                )}
                onClick={onMenuSelected}
              >
                {props.categoryTitle}
              </Text>
            </Link>
          </li>
        </ul>
      </div>
      {props.convolutedNav.map((elem) => {
        const parentCategory = props.category.replace(' ', '-')

        return (
          <div key={elem.category}>
            <Link href={`/${parentCategory}/${elem.category}/`} passHref>
              <Text
                variant="a"
                color="greyscaleGrey"
                size="normal"
                className="block px-3 py-px font-medium capitalize"
                onClick={onMenuSelected}
              >
                {/* Split */}
                {fixTitle(elem)}
              </Text>
            </Link>

            <ul className="mt-1 space-y-1 ">
              {elem.posts.map((post) => {
                const pathToLink =
                  post.fileName != 'index'
                    ? `/${parentCategory}/${elem.category}/${post.fileName}`
                    : `/${parentCategory}/${elem.category}`

                const shouldHighlight =
                  router.query.subcategory === elem.category && router.query.post === post.fileName

                const shouldHighlightSubcategories =
                  !router.query.post &&
                  post.fileName === 'index' &&
                  elem.category === router.query.subcategory

                return (
                  <li
                    className={clsx(
                      'transition duration-300 ease-in-out rounded-md hover:text-black hover:bg-veryLightGray',
                      (shouldHighlight || shouldHighlightSubcategories) && 'bg-veryLightGray'
                    )}
                    key={pathToLink}
                  >
                    <Link href={pathToLink} passHref>
                      <Text
                        variant="a"
                        color="greyscaleDark"
                        size="normal"
                        className={clsx(
                          'py-1.5 px-3 block transition-colors duration-300 ease-in-out text-greyscaleDark hover:text-dark subpixel-antialiased block',
                          (shouldHighlight || shouldHighlightSubcategories) && 'font-medium'
                        )}
                        onClick={onMenuSelected}
                      >
                        {post.title}
                      </Text>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
