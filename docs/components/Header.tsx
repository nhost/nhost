import { ArrowLeftIcon, MenuIcon } from '@heroicons/react/outline'
import clsx from 'clsx'
import { useRouter } from 'next/dist/client/router'
import Link from 'next/link'
import React, { useEffect } from 'react'
import { useState } from 'react'

import Button from '../components/ui/Button'
import { Nav } from './Nav'

export default function Header({ children }) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const router = useRouter()
  const GithubStarsCounter = () => {
    const repoUrl = `https://api.github.com/repos/nhost/nhost`
    const [count, setCount] = useState(null)
    const format = (n) => (n > 1000 ? `${(n / 1000).toFixed(1)}k` : n)

    useEffect(() => {
      ;(async () => {
        const data = await fetch(repoUrl).then((res) => res.json())
        setCount(data.stargazers_count)
      })()
    }, [])

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

  if (mobileMenu) {
    return (
      <MobileNav setMobileMenu={setMobileMenu} mobileMenu={mobileMenu}>
        {children}
      </MobileNav>
    )
  }

  return (
    <header className="bg-white md:max-w-full menu-card rounded-md px-4 py-0.5 mx-2">
      <div className="md:max-w-header2 mx-auto font-display flex flex-row antialiased">
        <div className="flex flex-row w-full mx-auto place-content-between py-2">
          <div className="flex flex-row">
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center cursor-pointer text-greyscaleDark"
              aria-label="Open menu"
              onClick={() => setMobileMenu(!mobileMenu)}
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

export function MobileNav({ setMobileMenu, mobileMenu }) {
  const router = useRouter()

  return (
    <div className="bg-white menu-card rounded-lg px-4 pb-6 max-w-full mx-2">
      <div className="flex flex-col w-full py-3 mx-auto">
        <div className="grid grid-flow-col justify-between items-center">
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center cursor-pointer text-greyscaleDark"
            aria-label="Close menu"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <MenuIcon className="h-6 w-6" aria-hidden="true" />
          </button>

          <Link href="/" passHref>
            <a className="md:hidden ml-3 sm:ml-0 self-center flex flex-row cursor-pointer">
              <img src="/images/nhost-docs.svg" width={110} height={35} alt="Nhost white logo" />
              <h1 className="self-center ml-5 font-medium text-greyscaleDark">DOCS</h1>
            </a>
          </Link>

          {/* Placeholder for making logo appear correctly in the middle */}
          <div className="w-8 h-8" />
        </div>
        <div className="flex py-6 mt-4 border-divide border-t border-b">
          <ul className="flex flex-col font-medium text-greyscaleDark text-base- font-display space-y-4 text-left px-4 ">
            <li
              className={clsx(
                'cursor-pointer text-base-  hover:text-greyscaleDark transition-colors duration-200 text-left ',
                router.query.category === 'get-started' && 'text-greyscaleDark'
              )}
            >
              <Link href="/get-started" passHref={true}>
                Get Started
              </Link>
            </li>
            <li
              className={clsx(
                'cursor-pointer text-base- hover:text-greyscaleDark transition-colors duration-200 text-left',
                router.query.category === 'platform' && 'text-greyscaleDark'
              )}
            >
              <Link href="/platform" passHref={true}>
                <a>Platform</a>
              </Link>
            </li>
            <li
              className={clsx(
                'cursor-pointer text-base- hover:text-greyscaleDark transition-colors duration-200',
                router.query.category === 'reference' && 'text-greyscaleDark'
              )}
            >
              <Link href="/reference" passHref={true}>
                <a>Reference</a>
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="sm:flex self-center py-2">
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
  )
}
