import { FaFile, FaHouseUser, FaQuestion, FaSignOutAlt, FaLock } from 'react-icons/fa'
import { SiApollographql } from 'react-icons/si'
import { useLocation, useNavigate } from 'react-router'
import { Link } from 'react-router-dom'

import { Group, MantineColor, Navbar, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useAuthenticated, useSignOut } from '@nhost/react'
interface MenuItemProps {
  icon: React.ReactNode
  color?: MantineColor
  label: string
  link?: string
  action?: () => void
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, color, label, link, action }) => {
  const location = useLocation()
  const active = location.pathname === link
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

  return link ? <Link to={link}>{Button}</Link> : Button
}

const data: MenuItemProps[] = [
  { icon: <FaHouseUser size={16} />, label: 'Home', link: '/' },
  { icon: <FaHouseUser size={16} />, label: 'Profile', link: '/profile' },
  { icon: <FaLock size={16} />, label: 'Secret Notes', link: '/secret-notes' },
  { icon: <FaFile size={16} />, label: 'Storage', link: '/storage' },
  { icon: <SiApollographql size={16} />, label: 'Apollo', link: '/apollo' },
  { icon: <FaQuestion size={16} />, label: 'About', link: '/about' }
]

export default function NavBar() {
  const authenticated = useAuthenticated()
  const { signOut } = useSignOut()
  const navigate = useNavigate()
  const links = data.map((link) => <MenuItem {...link} key={link.label} />)
  return (
    <Navbar width={{ sm: 300, lg: 400, base: 100 }} aria-label="main navigation">
      <Navbar.Section grow mt="md">
        {links}
        {authenticated && (
          <MenuItem
            icon={<FaSignOutAlt />}
            label="Sign Out"
            action={async () => {
              await signOut()
              navigate('/', { replace: true })
            }}
          />
        )}
      </Navbar.Section>
    </Navbar>
  )
}
