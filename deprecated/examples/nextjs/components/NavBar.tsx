import Link from 'next/link'
import { useRouter } from 'next/router'
import { FaGlobe, FaHouseUser, FaLock, FaQuestion, FaSignOutAlt } from 'react-icons/fa'

import { Group, MantineColor, Navbar, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useAuthenticated, useSignOut } from '@nhost/nextjs'

interface MenuItemProps {
  icon: React.ReactNode
  color?: MantineColor
  label: string
  link?: string
  action?: () => void
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, color, label, link, action }) => {
  const { route } = useRouter()
  const active = route === link
  const Button = (
    <UnstyledButton
      onClick={action}
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        padding: theme.spacing.xs,
        borderRadius: theme.radius.sm,
        color: active
          ? theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 7]
          : theme.colorScheme === 'dark'
          ? theme.colors.dark[0]
          : theme.black,

        '&:hover': {
          backgroundColor:
            theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0]
        }
      })}
    >
      <Group>
        <ThemeIcon color={color} variant="outline">
          {icon}
        </ThemeIcon>

        <Text size="sm">{label}</Text>
      </Group>
    </UnstyledButton>
  )

  return link ? (
    <Link href={link} passHref>
      {Button}
    </Link>
  ) : (
    Button
  )
}

const data: MenuItemProps[] = [
  { icon: <FaHouseUser size={16} />, color: 'blue', label: 'Home', link: '/' },
  {
    icon: <FaGlobe size={16} />,
    label: 'Public Client-side',
    link: '/public-csr'
  },
  {
    icon: <FaGlobe size={16} />,
    color: 'grape',
    label: 'Public Server-side',
    link: '/public-ssr'
  },
  {
    icon: <FaLock size={16} />,
    label: 'Guarded Client-side',
    link: '/guarded-csr'
  },
  {
    icon: <FaLock size={16} />,
    color: 'grape',
    label: 'Guarded Server-side',
    link: '/guarded-ssr'
  },
  { icon: <FaQuestion size={16} />, label: 'About', link: '/about' }
]

export default function NavBar() {
  const authenticated = useAuthenticated()
  const { signOut } = useSignOut()
  const router = useRouter()
  const links = data.map((link) => <MenuItem {...link} key={link.label} />)
  return (
    <Navbar width={{ sm: 300, lg: 400, base: 100 }}>
      <Navbar.Section grow mt="md">
        {links}
        {authenticated && (
          <MenuItem
            icon={<FaSignOutAlt />}
            label="Sign Out"
            action={async () => {
              await signOut()
              router.replace('/')
            }}
          />
        )}
      </Navbar.Section>
    </Navbar>
  )
}
