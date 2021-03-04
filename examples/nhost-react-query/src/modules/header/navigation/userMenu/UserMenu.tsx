import Link from 'next/link'
import { Menu, MenuButton, Button, MenuList, MenuItem, Avatar } from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { ReactElement } from 'react'

interface UserMenuProps {
  logout: () => void
  name: string
  avatarSrc: string
}

const UserMenu = ({ logout, name, avatarSrc }: UserMenuProps): ReactElement => {
  return (
    <Menu>
      <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
        <Avatar name={name} src={avatarSrc} size="sm" />
      </MenuButton>
      <MenuList minW="10rem">
        <Link href="/profile">
          <MenuItem>Profile</MenuItem>
        </Link>
        <MenuItem onClick={logout}>Logout</MenuItem>
      </MenuList>
    </Menu>
  )
}

export default UserMenu
