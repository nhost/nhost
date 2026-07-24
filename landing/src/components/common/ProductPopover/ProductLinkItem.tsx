import Image from 'next/image'
import Link from '../Link/Link'
import { ReactNode } from 'react'

export interface ProductLinkItemProps {
  href: string
  icon: string
  title: string
  description: string
  onClick?: () => void
  isVisible?: boolean
  animationDelay?: string
  className?: string
  isAddon?: boolean
  children?: ReactNode
}

export default function ProductLinkItem({
  href,
  icon,
  title,
  description,
  onClick,
  isVisible = true,
  animationDelay = '0ms',
  className = '',
  isAddon = false,
  children,
}: ProductLinkItemProps) {
  return (
    <Link
      href={href}
      className={`group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline ${className}`}
      onClick={onClick}
      role="menuitem"
      style={{
        animationDelay,
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 300ms ease, opacity 300ms ease',
      }}
    >
      <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
        <div
          className={`absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/${
            isAddon ? '5' : '0'
          } to-brand-main/0 opacity-${
            isAddon ? '30' : '0'
          } transition-opacity duration-300 group-hover:from-brand-main/${
            isAddon ? '15' : '10'
          } group-hover:to-brand-main/0 group-hover:opacity-100`}
        ></div>

        {/* {isAddon && (
          <div className="absolute top-1.5 right-1.5 rounded-full border border-brand-main/25 bg-brand-main/10 px-1 py-0.5 text-[7px] font-medium tracking-wide text-brand-main">
            ADD-ON
          </div>
        )}
 */}
        <div className="relative flex h-full items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
            <Image
              src={icon}
              alt={`${title} icon`}
              width={24}
              height={24}
              style={{ width: 'auto', height: 'auto' }}
              className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            />
          </div>
          <div className="ml-3 max-w-[140px]">
            <p className="text-[11px] font-medium leading-tight text-white">
              {title}
            </p>
            <p className="line-clamp-2 mt-0.5 text-[10px] leading-tight text-white text-opacity-60">
              {description}
            </p>
            {children}
          </div>
        </div>
      </div>
    </Link>
  )
}
