import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react' // Update import
import { twMerge } from 'tailwind-merge'

type ButtonProps = {
  type?: 'button' | 'submit' | 'reset' | undefined
} & DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>

export default function Button({ disabled, type, children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      type={type}
      {...rest}
      className={twMerge(
        disabled && 'bg-indigo-200 hover:bg-grey-700',
        !disabled &&
          'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
        'inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none'
      )}
    >
      {children}
    </button>
  )
}
