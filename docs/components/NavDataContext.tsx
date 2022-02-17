import { ParsedUrlQuery } from 'querystring'
import { createContext, PropsWithChildren, useContext } from 'react'

export type Post = {
  /**
   * Title of the post.
   */
  title: string
  /**
   * File name where the post is located.
   */
  fileName: string
  /**
   * Order of posts.
   */
  order: string[]
}

export type NavItem = {
  /**
   * Slug of the category.
   */
  category: string
  /**
   * List of posts in the category.
   */
  posts: Post[]
}

export type NavDataContextProps = {
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
   * Available menu items for all categories.
   */
  availableCategoryMenus: {
    /**
     * Slug of the category.
     */
    slug: string
    /**
     * Menu items of the category.
     */
    items: NavItem[]
  }[]
}

export const NavDataContext = createContext<NavDataContextProps>(null)

export function NavDataProvider({ children, ...props }: PropsWithChildren<NavDataContextProps>) {
  return <NavDataContext.Provider value={props}>{children}</NavDataContext.Provider>
}

export function useNavData() {
  const context = useContext(NavDataContext)

  if (!context) {
    throw new Error(`"useNavData" must be used within a "NavDataProvider"`)
  }

  /**
   * Returns all of the navigation items for the specified category.
   *
   * @param slug Slug of the category.
   * @returns All of the navigation items for the specified category.
   */
  function getConvolutedNavByCategory(slug: string) {
    return (
      context.availableCategoryMenus.find(({ slug: category }) => category === slug)?.items ||
      context.convolutedNav
    )
  }

  return { getConvolutedNavByCategory, ...context }
}
