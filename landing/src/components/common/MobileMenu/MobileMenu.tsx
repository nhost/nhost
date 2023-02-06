import { useAnnouncement } from '@/hooks/useAnnouncement'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container } from '../Container'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { ChevronUpIcon } from '../icons/ChevronUpIcon'

export interface MobileMenuProps {
  /**
   * Function to call when the user clicks on a link.
   */
  onLinkClick?: VoidFunction
}

export default function MobileMenu({ onLinkClick }: MobileMenuProps) {
  const [productExpanded, setProductExpanded] = useState(false)
  const { showAnnouncement } = useAnnouncement()

  return (
    <Container
      slotProps={{
        root: {
          className: twMerge(
            'fixed bottom-0 left-0 right-0 z-50 w-full bg-black pt-4 pb-16 overflow-auto',
            showAnnouncement ? 'top-26' : 'top-16',
          ),
        },
      }}
      className="pt-4"
    >
      <nav aria-label="Mobile navigation">
        <ul className="grid grid-flow-row gap-8 font-medium">
          <li>
            <Button
              onClick={() => setProductExpanded((current) => !current)}
              variant="borderless"
              className="w-full justify-between text-xl font-normal"
              size="sm"
            >
              Product{' '}
              {productExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </Button>
          </li>
          {productExpanded && (
            <ul className="grid grid-flow-row gap-6">
              <li>
                <Button
                  size="sm"
                  variant="borderless"
                  href="/product/database"
                  className="w-full text-base text-opacity-65"
                  onClick={onLinkClick}
                >
                  Database
                </Button>
              </li>
              <li>
                <Button
                  size="sm"
                  variant="borderless"
                  href="/product/graphql"
                  className="w-full text-base text-opacity-65"
                  onClick={onLinkClick}
                >
                  GraphQL
                </Button>
              </li>
              <li>
                <Button
                  size="sm"
                  variant="borderless"
                  href="/product/auth"
                  className="w-full text-base text-opacity-65"
                  onClick={onLinkClick}
                >
                  Auth
                </Button>
              </li>
              <li>
                <Button
                  size="sm"
                  variant="borderless"
                  href="/product/storage"
                  className="w-full text-base text-opacity-65"
                  onClick={onLinkClick}
                >
                  Storage
                </Button>
              </li>
              <li>
                <Button
                  size="sm"
                  variant="borderless"
                  href="/product/functions"
                  className="w-full text-base text-opacity-65"
                  onClick={onLinkClick}
                >
                  Functions
                </Button>
              </li>
            </ul>
          )}
          <li>
            <Button
              size="sm"
              variant="borderless"
              href="https://docs.nhost.io"
              className="w-full text-xl font-normal"
              onClick={onLinkClick}
            >
              Docs
            </Button>
          </li>
          <li>
            <Button
              size="sm"
              variant="borderless"
              href="/blog"
              className="w-full text-xl font-normal"
              onClick={onLinkClick}
            >
              Blog
            </Button>
          </li>
          <li>
            <Button
              size="sm"
              variant="borderless"
              href="/about"
              className="w-full text-xl font-normal"
              onClick={onLinkClick}
            >
              About
            </Button>
          </li>
          <li>
            <Button
              size="sm"
              variant="borderless"
              href="/changelog"
              className="w-full text-xl font-normal"
              onClick={onLinkClick}
            >
              Changelog
            </Button>
          </li>
          <li>
            <Button
              size="sm"
              variant="borderless"
              href="/customers"
              className="w-full text-xl font-normal"
              onClick={onLinkClick}
            >
              Customers
            </Button>
          </li>
          <li>
            <Button
              size="sm"
              variant="borderless"
              href="/pricing"
              className="w-full text-xl font-normal"
              onClick={onLinkClick}
            >
              Pricing
            </Button>
          </li>
        </ul>
      </nav>
    </Container>
  )
}
