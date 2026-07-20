import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { ChevronUpIcon } from '../icons/ChevronUpIcon'

import { ProductLinkItem } from '.'

export default function ProductPopover({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
    animationTimeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 10) // Small delay for opening animation
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        setIsOpen(false)
      }, 200) // Match transition duration for closing
    }, 100) // Small delay before closing to prevent accidental closes
  }

  const handleLinkClick = () => {
    setIsVisible(false)
    setTimeout(() => {
      setIsOpen(false)
    }, 100)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="grid cursor-pointer grid-flow-col items-center gap-2 p-1.5 text-white text-opacity-65 transition-colors hover:text-[#0066FF] focus:outline-none active:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Product{' '}
        {isOpen ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div
          className={`fixed top-16 left-1/2 z-[9999] mt-2 w-[980px] -translate-x-1/2 transform rounded-xl border border-white/10 bg-default p-5 py-6 shadow-lg ring-1 ring-brand-main/10 transition-all duration-200 ease-in-out ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="product-menu-button"
        >
          <div className="relative flex items-stretch gap-6">
            <div className="flex-1 rounded-xl border border-white/5 bg-gradient-to-br from-[#001743]/20 to-black/30 p-4">
              <h3
                className="mb-3 ml-1 text-[10px] font-medium uppercase tracking-wider text-white/60"
                style={{
                  animationDelay: '0ms',
                  transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'transform 200ms ease, opacity 200ms ease',
                }}
              >
                Start quickly with
              </h3>
              <div className="grid grid-cols-2 gap-3 [&>a>div]:border-white/10 [&>a>div]:bg-black/40 [&>a>div]:p-2.5 [&>a>div:hover]:border-brand-main/40">
                <ProductLinkItem
                  href="/product/database"
                  icon="/products/database.svg"
                  title="Database"
                  description="Postgres database"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="0ms"
                />

                <ProductLinkItem
                  href="/product/graphql"
                  icon="/products/graphql.svg"
                  title="GraphQL API"
                  description="Auto-generated GraphQL API"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="50ms"
                />

                <ProductLinkItem
                  href="/product/auth"
                  icon="/products/authentication.svg"
                  title="Auth"
                  description="User management"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="100ms"
                />

                <ProductLinkItem
                  href="/product/storage"
                  icon="/products/storage.svg"
                  title="Storage"
                  description="File storage"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="150ms"
                />
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-white/5 bg-gradient-to-br from-[#0066FF]/10 to-black/30 p-4">
              <h3
                className="mb-3 ml-1 text-[10px] font-medium uppercase tracking-wider text-white/60"
                style={{
                  animationDelay: '',
                  transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'transform 200ms ease, opacity 200ms ease',
                }}
              >
                Extend with
              </h3>
              <div className="grid grid-cols-2 grid-rows-2 gap-3 [&>a>div]:border-white/10 [&>a>div]:bg-black/40 [&>a>div]:p-2.5 [&>a>div:hover]:border-brand-main/40">
                <ProductLinkItem
                  href="/product/functions"
                  icon="/products/functions.svg"
                  title="Functions"
                  description="Serverless functions"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="200ms"
                />

                {/* AI */}
                <ProductLinkItem
                  href="/product/ai"
                  icon="/products/ai-assistants.svg"
                  title="AI"
                  description="AI Agents"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="250ms"
                  isAddon={true}
                />

                <ProductLinkItem
                  href="/product/run"
                  icon="/products/run-cloud.svg"
                  title="Run"
                  description="Custom services"
                  onClick={handleLinkClick}
                  isVisible={isVisible}
                  animationDelay="300ms"
                  className="col-span-2"
                >
                  <div className="mt-1.5 flex gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black/60 font-mono text-[7px] font-semibold text-white/80 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-brand-main/10 group-hover:ring-brand-main/30">
                      Go
                    </span>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black/60 font-mono text-[7px] font-semibold text-white/80 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-brand-main/10 group-hover:ring-brand-main/30">
                      Py
                    </span>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black/60 font-mono text-[7px] font-semibold text-white/80 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-brand-main/10 group-hover:ring-brand-main/30">
                      Rs
                    </span>
                  </div>
                </ProductLinkItem>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
