import { useNavData } from '@/components/NavDataContext'
import { ArrowLeftIcon, MenuIcon, RefreshIcon } from '@heroicons/react/outline'
import clsx from 'clsx'
import { useRouter } from 'next/dist/client/router'
import Link from 'next/link'
import React, { MouseEvent, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Nav, NavProps } from './Nav'

export default function Header() {
  const [mobileMenu, setMobileMenu] = useState(false)
  const router = useRouter()
  const GithubStarsCounter = () => {
    const repoUrl = `https://api.github.com/repos/nhost/nhost`
    const [count, setCount] = useState(null)
    const format = (n: number) => (n > 1000 ? `${(n / 1000).toFixed(1)}k` : n)

    useEffect(() => {
      ;(async () => {
        const data = await fetch(repoUrl).then((res) => res.json())
        setCount(data.stargazers_count)
      })()
    }, [repoUrl])

    return (
      <a
        className="text-base font-medium leading-snug flex flex-row items-center justify-center px-2.5 py-1.5 rounded opacity-50 hover:opacity-100 mr-8"
        href="https://github.com/nhost/nhost"
        target="_blank"
        rel="noreferrer"
      >
        <img
          className="mr-2"
          src="/logos/Github2.svg"
          width={20}
          height={20}
          alt="Nhost on GitHub"
        />
        {count === null ? 0 : format(count)}
      </a>
    )
  }

  function handleMobileMenuOpen() {
    setMobileMenu(true)
  }

  function handleMobileMenuClose() {
    setMobileMenu(false)
  }

  if (mobileMenu) {
    return <MobileNav onClose={handleMobileMenuClose} />
  }

  return (
    <header className="bg-white md:max-w-full menu-card rounded-md px-4 py-0.5 mx-2">
      <div className="md:max-w-header2 mx-auto font-display flex flex-row antialiased">
        <div className="flex flex-row w-full mx-auto place-content-between py-2">
          <div className="flex flex-row">
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center cursor-pointer text-greyscaleDark"
              aria-label="Open menu"
              onClick={handleMobileMenuOpen}
            >
              <MenuIcon className="h-6 w-6" />
            </button>

            <Link href="/get-started" passHref>
              <a className="hidden ml-3 sm:ml-0 self-center md:flex flex-row cursor-pointer">
                <img src="/images/nhost-docs.svg" width={110} height={35} alt="Nhost white logo" />
                <h1 className="self-center ml-6 font-medium text-greyscaleDark">DOCS</h1>
              </a>
            </Link>

            <div className="ml-20 hidden md:flex flex-row self-center ">
              <ul className="flex flex-row items-center self-center antialiased font-medium text-greyscaleGrey font-display">
                <Link href="/get-started" passHref={true}>
                  <a
                    className={clsx(
                      'cursor-pointer text-base- self-center hover:text-greyscaleDark transition-colors duration-200 py-3',
                      router.query.category === 'get-started' && 'text-greyscaleDark'
                    )}
                  >
                    Get Started
                  </a>
                </Link>
                <Link href="/platform" passHref={true}>
                  <a
                    className={clsx(
                      'ml-12 cursor-pointer text-base- self-center hover:text-greyscaleDark transition-colors duration-200 py-3',
                      router.query.category === 'platform' && 'text-greyscaleDark'
                    )}
                  >
                    Platform
                  </a>
                </Link>

                <Link href="/reference" passHref={true}>
                  <a
                    className={clsx(
                      'ml-12 cursor-pointer text-base- self-center hover:text-greyscaleDark transition-colors duration-200 py-3',
                      router.query.category === 'reference' && 'text-greyscaleDark'
                    )}
                  >
                    Reference
                  </a>
                </Link>
              </ul>
            </div>
          </div>
          <div className="hidden sm:flex self-center">
            <GithubStarsCounter />
            <Button
              className="self-center"
              variant="primary"
              href={'https://app.nhost.io'}
              Component="a"
              target="_blank"
              rel="noreferrer"
            >
              Go to Nhost
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

export type MobileNavProps = {
  onClose?: VoidFunction
}

export function MobileNav({ onClose }: MobileNavProps) {
  const { getConvolutedNavByCategory } = useNavData()
  const router = useRouter()
  const [selectedMenuSlug, setSelectedMenuSlug] = useState<string | null>(null)
  const [selectedMenuName, setSelectedMenuName] = useState<string | null>(null)

  function handleMenuSelect(event: MouseEvent<HTMLAnchorElement>, slug: string, name: string) {
    event.preventDefault()

    setSelectedMenuSlug(slug)
    setSelectedMenuName(name)
  }

  function clearMenuSelection() {
    setSelectedMenuSlug(null)
    setSelectedMenuName(null)
  }

  return (
    <div className="bg-white menu-card rounded-lg px-4 pb-6 max-w-full mx-2">
      <div className="flex flex-col w-full py-3 mx-auto">
        <div className="grid grid-flow-col justify-between items-center">
          {!selectedMenuSlug && (
            <>
              <button
                className="w-8 h-8 flex items-center justify-center cursor-pointer text-greyscaleDark"
                aria-label="Close menu"
                onClick={onClose}
              >
                <MenuIcon className="h-6 w-6" aria-hidden="true" />
              </button>

              <Link href="/get-started" passHref>
                <a className="ml-3 sm:ml-0 self-center flex flex-row cursor-pointer">
                  <img
                    src="/images/nhost-docs.svg"
                    width={110}
                    height={35}
                    alt="Nhost white logo"
                  />
                  <h1 className="self-center ml-5 font-medium text-greyscaleDark">DOCS</h1>
                </a>
              </Link>
            </>
          )}

          {selectedMenuSlug && (
            <button
              className="ml-2 h-8 grid grid-flow-col gap-2 items-center justify-center cursor-pointer text-greyscaleDark"
              aria-label="Go back to main menu"
              onClick={clearMenuSelection}
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />{' '}
              <span className="font-medium text-base-">{selectedMenuName}</span>
            </button>
          )}

          {/* Placeholder for making logo appear correctly in the middle */}
          <div className="w-8 h-8" />
        </div>

        <div className="flex flex-col py-6 mt-4 border-divide border-t border-b">
          {!selectedMenuSlug && (
            <ul className="flex flex-col font-medium text-greyscaleDark text-base- font-display space-y-4 text-left px-4">
              <li
                className={clsx(
                  'cursor-pointer text-base-  hover:text-greyscaleDark transition-colors duration-200 text-left ',
                  router.query.category === 'get-started' && 'text-greyscaleDark'
                )}
              >
                <Link href="/get-started" passHref>
                  <a
                    className="block"
                    onClick={(event) => handleMenuSelect(event, 'get-started', 'Get Started')}
                  >
                    Get Started
                  </a>
                </Link>
              </li>
              <li
                className={clsx(
                  'cursor-pointer text-base- hover:text-greyscaleDark transition-colors duration-200 text-left',
                  router.query.category === 'platform' && 'text-greyscaleDark'
                )}
              >
                <Link href="/platform">
                  <a
                    className="block"
                    onClick={(event) => handleMenuSelect(event, 'platform', 'Platform')}
                  >
                    Platform
                  </a>
                </Link>
              </li>
              <li
                className={clsx(
                  'cursor-pointer text-base- hover:text-greyscaleDark transition-colors duration-200',
                  router.query.category === 'reference' && 'text-greyscaleDark'
                )}
              >
                <Link href="/reference">
                  <a
                    className="block"
                    onClick={(event) => handleMenuSelect(event, 'reference', 'Reference')}
                  >
                    Reference
                  </a>
                </Link>
              </li>
            </ul>
          )}

          {selectedMenuSlug && (
            <Nav
              category={selectedMenuSlug}
              categoryTitle={selectedMenuName}
              convolutedNav={getConvolutedNavByCategory(selectedMenuSlug)}
              onMenuSelected={onClose}
            />
          )}
        </div>
      </div>

      <div className="sm:flex self-center py-2">
        <Button
          className="self-center"
          variant="primary"
          href="https://app.nhost.io"
          Component="a"
          target="_blank"
          rel="noreferrer"
        >
          Go to Nhost
        </Button>
      </div>
    </div>
  )
}
