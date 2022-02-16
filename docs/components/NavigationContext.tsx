import { ParsedUrlQuery } from 'querystring'
import { createContext, PropsWithChildren, useContext } from 'react'

export type NavigationContextProps = {
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
  convolutedNav: any[]
  /**
   * Available menu items for all categories.
   */
  availableNavMenus: { name: string; items: any[] }[]
  /**
   * Custom router query.
   */
  query: ParsedUrlQuery
}

export const NavigationContext = createContext<NavigationContextProps>(null)

export function NavigationProvider({
  children,
  ...props
}: PropsWithChildren<NavigationContextProps>) {
  return <NavigationContext.Provider value={props}>{children}</NavigationContext.Provider>
}

export function useNavigationData() {
  const context = useContext(NavigationContext)

  if (!context) {
    throw new Error(`"useNavigationData" must be used within a "NavigationProvider"`)
  }

  return context
}
