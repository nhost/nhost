import cn from 'classnames'
import s from './Input.module.css'
import React, { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
  onChange?: (...args: any[]) => any
  disabled?: boolean
}

type Color = 'dark' | 'light'

const Input: React.FC<InputProps> = (props) => {
  const { className, children, onChange, color, disabled, placeholder = '', ...rest } = props

  const rootClassName = cn(
    s.root,
    { [s.disabled]: disabled, [s.dark]: color === 'dark' },
    className
  )

  const handleOnChange = (e: any) => {
    if (onChange) {
      onChange(e.target.value)
    }
    return null
  }

  return (
    <input
      className={rootClassName}
      onChange={handleOnChange}
      disabled={disabled}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      placeholder={placeholder}
      {...rest}
    />
  )
}

export default Input
