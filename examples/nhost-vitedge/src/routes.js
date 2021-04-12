import React from 'react'

// Auto generates routes from files under ./pages
// https://vitejs.dev/guide/features.html#glob-import
const pages = import.meta.glob('./pages/*.jsx')

// Follow `react-router-config` route structure
export const routes = Object.keys(pages).map((path) => {
  const name = path.match(/\.\/pages\/(.*)\.jsx$/)[1]
  let component = null

  return {
    name: name.toLowerCase(),
    path: name === 'Home' ? '/' : `/${name.toLowerCase()}`,
    // Async pages
    component: (props) => {
      if (!component) {
        const loadingComponent = pages[path]().then((result) => {
          component = result.default
        })

        // Suspense will re-render when component is ready
        throw loadingComponent
      }

      return React.createElement(component, props)
    },
  }
})
