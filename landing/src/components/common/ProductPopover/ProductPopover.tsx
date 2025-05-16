import Image from 'next/image'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { Link } from '../Link'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { ChevronUpIcon } from '../icons/ChevronUpIcon'

interface ProductItem {
  name: string
  description: string
  href: string
  icon: string
  group: 'stack' | 'extend'
}

const productItems: ProductItem[] = [
  {
    name: 'Database',
    description: 'Postgres database',
    href: '/product/database',
    icon: '/products/database.svg',
    group: 'stack',
  },
  {
    name: 'GraphQL API',
    description: 'Instant GraphQL API',
    href: '/product/graphql',
    icon: '/products/graphql.svg',
    group: 'stack',
  },
  {
    name: 'Auth',
    description: 'User management',
    href: '/product/auth',
    icon: '/products/authentication.svg',
    group: 'stack',
  },
  {
    name: 'Storage',
    description: 'File storage with permissions',
    href: '/product/storage',
    icon: '/products/storage.svg',
    group: 'stack',
  },
  {
    name: 'Functions',
    description: 'Serverless functions',
    href: '/product/functions',
    icon: '/products/functions.svg',
    group: 'extend',
  },
  {
    name: 'Run',
    description: 'Deploy custom services',
    href: '/product/run',
    icon: '/products/run-cloud.svg',
    group: 'extend',
  },
  {
    name: 'AI',
    description: 'AI assistants and embeddings',
    href: '/product/ai',
    icon: '/products/ai-assistants.svg',
    group: 'extend',
  },
]

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
            {/* Nhost Stack Group (2x2 matrix) */}
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
                {/* Database */}
                <Link
                  href="/product/database"
                  className="group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '0ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/0 to-brand-main/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-main/10 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/database.svg"
                          alt="Database icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          Database
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          Postgres database
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* GraphQL API */}
                <Link
                  href="/product/graphql"
                  className="group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '50ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/0 to-brand-main/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-main/10 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/graphql.svg"
                          alt="GraphQL API icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          GraphQL API
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          Instant GraphQL API
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Auth */}
                <Link
                  href="/product/auth"
                  className="group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '100ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/0 to-brand-main/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-main/10 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/authentication.svg"
                          alt="Auth icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          Auth
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          User management
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Storage */}
                <Link
                  href="/product/storage"
                  className="group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '150ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/0 to-brand-main/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-main/10 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/storage.svg"
                          alt="Storage icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          Storage
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          File storage with permissions
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Nhost Extend Group (2x2 matrix with Run taking 2 slots) */}
            <div className="flex-1 rounded-xl border border-white/5 bg-gradient-to-br from-[#0066FF]/10 to-black/30 p-4">
              <h3
                className="mb-3 ml-1 text-[10px] font-medium uppercase tracking-wider text-white/60"
                style={{
                  animationDelay: '100ms',
                  transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'transform 200ms ease, opacity 200ms ease',
                }}
              >
                Extend with
              </h3>
              <div className="grid grid-cols-2 grid-rows-2 gap-3 [&>a>div]:border-white/10 [&>a>div]:bg-black/40 [&>a>div]:p-2.5 [&>a>div:hover]:border-brand-main/40">
                {/* Functions */}
                <Link
                  href="/product/functions"
                  className="group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '200ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/0 to-brand-main/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-main/10 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/functions.svg"
                          alt="Functions icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          Functions
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          Serverless functions
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* AI */}
                <Link
                  href="/product/ai"
                  className="group block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '250ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="group-hover:from-brand-main/15 absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/5 to-brand-main/0 opacity-30 transition-opacity duration-300 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="absolute top-1.5 right-1.5 rounded-full border border-brand-main/25 bg-brand-main/10 px-1 py-0.5 text-[7px] font-medium tracking-wide text-brand-main">
                      ADD-ON
                    </div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/ai-assistants.svg"
                          alt="AI icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          AI
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          AI assistants and embeddings
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Run (spanning 2 columns) */}
                <Link
                  href="/product/run"
                  className="group col-span-2 block overflow-hidden rounded-xl transition-all duration-300 hover:no-underline"
                  onClick={handleLinkClick}
                  role="menuitem"
                  style={{
                    animationDelay: '300ms',
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'transform 300ms ease, opacity 300ms ease',
                  }}
                >
                  <div className="relative h-full rounded-xl border border-white/5 bg-paper p-4 transition-all duration-300 group-hover:border-brand-main/30">
                    <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-main/0 to-brand-main/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-main/10 group-hover:to-brand-main/0 group-hover:opacity-100"></div>

                    <div className="relative flex h-full items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/50 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-brand-dark/20 group-hover:to-black/70 group-hover:shadow-[0_0_18px_rgba(0,102,255,0.25)] group-hover:ring-brand-main/50">
                        <Image
                          src="/products/run-cloud.svg"
                          alt="Run icon"
                          width={24}
                          height={24}
                          style={{ width: 'auto', height: 'auto' }}
                          className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </div>
                      <div className="ml-3 max-w-[140px]">
                        <p className="text-[10px] font-medium leading-tight text-white">
                          Run
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[9px] leading-tight text-white text-opacity-60">
                          Deploy custom services
                        </p>
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
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
