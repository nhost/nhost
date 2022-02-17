import cn from 'classnames'
import React, { CSSProperties, FunctionComponent, JSXElementConstructor } from 'react'
import s from './Text.module.css'

export interface TextProps {
  variant?: Variant
  className?: string
  style?: CSSProperties
  children?: React.ReactNode | any
  color?: Color
  html?: string
  size?: Size
  target?: any
  rel?: any
  href?: string
  onClick?: () => any
  name?: any
}

type Variant = 'heading' | 'body' | 'pageHeading' | 'sectionHeading' | 'item' | 'subHeading' | 'a'

type Size = 'tiny' | 'small' | 'normal' | 'large' | 'big' | 'heading'

type Color = 'dark' | 'grey' | 'blue' | 'greyscaleDark' | 'greyscaleGrey' | 'red' | 'white'

export const Text: FunctionComponent<TextProps> = ({
  style,
  className = '',
  variant = 'body',
  color,
  children,
  html,
  onClick,
  size,
  rel,
  href,
  target,
  name
}) => {
  const componentsMap: {
    [P in Variant]: React.ComponentType<any> | string
  } = {
    body: 'div',
    heading: 'h1',
    pageHeading: 'h1',
    sectionHeading: 'h2',
    subHeading: 'h3',
    item: 'p',
    a: 'a'
  }

  const Component:
    | JSXElementConstructor<any>
    | React.ReactElement<any>
    | React.ComponentType<any>
    | string = componentsMap![variant!]

  const htmlContentProps = html
    ? {
        dangerouslySetInnerHTML: { __html: html }
      }
    : {}

  const aProps =
    variant === 'a'
      ? {
          rel,
          href,
          target
        }
      : {}

  return (
    <Component
      className={cn(
        s.root,
        {
          [s.body]: variant === 'body',
          [s.a]: variant === 'a',
          [s.heading]: variant === 'heading',
          [s.pageHeading]: variant === 'pageHeading',
          [s.sectionHeading]: variant === 'sectionHeading',
          [s.subHeading]: variant === 'subHeading',
          [s.item]: variant === 'item',
          [s.dark]: color === 'dark',
          [s.greyscaleDark]: color === 'greyscaleDark',
          [s.grey]: color === 'grey',
          [s.blue]: color === 'blue',
          [s.tiny]: size === 'tiny',
          [s.small]: size === 'small',
          [s.normal]: size === 'normal',
          [s.large]: size === 'large',
          [s.big]: size === 'big',
          [s.heading]: size === 'heading',
          [s.greyscaleGrey]: color === 'greyscaleGrey',
          [s.red]: color === 'red',
          [s.white]: color === 'white'
        },
        className
      )}
      onClick={onClick}
      style={style}
      {...htmlContentProps}
      {...aProps}
      name={name}
    >
      {children}
    </Component>
  )
}

export default Text
