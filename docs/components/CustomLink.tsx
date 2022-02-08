import { withRouter } from 'next/router'
import Link from 'next/link'
import React, { Children } from 'react'

const CustomLink = ({ router, children, ...props }) => {
  const child = Children.only(children)

  let className = child.props.className || ''
  const pathname = `/${router.query.category}/${router.query.post}`

  if (pathname === props.href && props.activeClassName) {
    className = `${className} ${props.activeClassName}`.trim()
  }

  delete props.activeClassName

  //   @ts-ignore
  return <Link {...props}>{React.cloneElement(child, { className })}</Link>
}

export default withRouter(CustomLink)
