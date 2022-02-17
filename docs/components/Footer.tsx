import Button from '@/components/ui/Button'
import siteLinks from '@/data/siteLinks.json'
import Link from 'next/link'
import React from 'react'
import { useState } from 'react'

import { Newsletter } from './Newsletter'

// import Input from './ui/Input/Input';
export default function Footer() {
  const [email, setEmail] = useState('')

  return (
    <div className="bg-verydark">
      <div className="max-w-mxcontainer px-5 mx-auto">
        <div className="flex flex-col pt-20">
          {/* Logo and CTA */}
          <div className="place-content-between flex flex-row">
            <div className="">
              <img
                src="/logos/nhost-footer-logo.svg"
                width={141.57}
                height={48}
                alt="Nhost white logo"
              />
            </div>
            <div className="flex flex-row self-center">
              <Button
                Component="a"
                variant="secondary"
                className="md:visible invisible mr-2 text-white cursor-pointer"
                href="mailto:hello@nhost.io"
                type={null}
              >
                Contact Us
              </Button>
              <Button
                Component="a"
                variant="primary"
                href="https://app.nhost.io"
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer"
                type={null}
              >
                <span className="md:block hidden">Sign up or Log in</span>
                <span className="md:hidden">Sign up</span>
              </Button>
            </div>
          </div>
          {/* All links */}
          {/* @FIX: space-x on the firSubscribest one. */}
          <div className="font-display md:flex-row flex flex-col mt-12">
            <div className="gap-14 md:grid-flow-col md:grid-cols-5 grid grid-flow-row grid-cols-1">
              {siteLinks.siteLinks.map((siteLink, i) => {
                return (
                  <FooterLinks
                    key={siteLink.text + i}
                    title={siteLink.text}
                    links={siteLink.links}
                  />
                )
              })}
            </div>
          </div>
          <Newsletter />
          {/* <Newsletter email={email} setEmail={setEmail} /> */}
          {/* Socials */}
          {/* @FIX: mt is 103px */}
          <div className="md:mx-0 place-content-between font-display md:flex-row flex flex-col pb-2 mx-auto mt-24">
            <div className="pb-2">
              <ul className="flex flex-row space-x-6">
                <li className="items-center self-center align-middle">
                  <a href="https://github.com/nhost" target="_blank" rel="noreferrer">
                    <img src="/logos/Github.svg" width={25} height={25} alt="Nhost on GitHub" />
                  </a>
                </li>
                <li className="items-center self-center align-middle">
                  <a href="https://twitter.com/nhostio" target="_blank" rel="noreferrer">
                    <img src="/logos/Twitter.svg" width={25} height={25} alt="Nhost on Twitter" />
                  </a>
                </li>
                <li className="items-center self-center align-middle">
                  <a
                    href="https://www.linkedin.com/company/nhost/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img src="/logos/Linkedin.svg" width={25} height={25} alt="Nhost in LinkedIn" />
                  </a>
                </li>
                <li className="items-center self-center align-middle">
                  <a href="https://discord.com/invite/9V7Qb2U" target="_blank" rel="noreferrer">
                    <img
                      src="/logos/Discord.svg"
                      width={25}
                      height={25}
                      alt="Nhost community on Discord"
                    />
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:pt-0 md:space-y-0 md:flex-row flex flex-col pt-2 space-y-4 text-xs font-medium text-white">
              <a
                className="translucent self-center"
                href="https://nhost.io/privacy-policy"
                target="_blank"
                rel="noreferrer"
              >
                Privacy Policy
              </a>
              <a
                className="md:pl-6 translucent self-center"
                href="https://nhost.io/terms-of-service"
                target="_blank"
                rel="noreferrer"
              >
                Terms of Service
              </a>

              <a
                className="md:pl-6 translucent self-center"
                href="https://nhost.io"
                target="_blank"
                rel="noreferrer"
              >
                nhost.io 2022
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
interface FooterLinkProps {
  title: string
  links: Links[]
}
interface Links {
  name: string
  href: string
}
function FooterLinks({ title, links }: FooterLinkProps) {
  return (
    <div>
      {/* color */}
      <h1 className="font-medium text-gray-700 uppercase">{title}</h1>
      <ul className="mt-4 space-y-4">
        {links.map((link) => {
          return (
            <li key={link.name} className="text-white font-normal text-sm+ cursor-pointer">
              <Link href={link.href}>{link.name}</Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
