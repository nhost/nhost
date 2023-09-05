'use client'

import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

// @ts-ignore
import { experimental_useFormStatus as useFormStatus } from 'react-dom'

type ButtonProps = {
  type?: 'button' | 'submit' | 'reset' | undefined
} & DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>

export default function SubmitButton({ disabled, type, children, ...rest }: ButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      disabled={pending}
      type={type}
      {...rest}
      className={twMerge(
        pending
          ? 'bg-indigo-200 hover:bg-grey-700'
          : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
        'inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none'
      )}
    >
      {children}
    </button>
  )
}
