'use client'

import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react'
// @ts-ignore
import { useFormStatus } from 'react-dom'
import { twMerge } from 'tailwind-merge'

type ButtonProps = {
  type?: 'button' | 'submit' | 'reset' | undefined
} & DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>

export default function SubmitButton({
  disabled,
  type,
  className,
  children,
  ...rest
}: ButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type={type}
      disabled={pending}
      className={twMerge(
        pending
          ? 'bg-indigo-200 hover:bg-grey-700'
          : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
        className,
        'inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none'
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
