import { useSignOut } from '@nhost/react'
import {
  Archive,
  CircleHelp,
  FileLock2,
  Home,
  LineChart,
  LogOut,
  Package,
  Package2,
  PanelLeft,
  Settings,
  ShoppingCart,
  User,
  Users2
} from 'lucide-react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Button } from '../../ui/button'
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger
// } from '../../ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '../../ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import Nhost from '../../../assets/nhost.svg'

export default function Layout() {
  const { signOut } = useSignOut()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  console.log({
    render: true
  })

  return (
    <div className="flex flex-col w-full min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 flex-col hidden border-r w-14 bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <NavLink
                to="/"
                className="flex items-center justify-center rounded-full h-9 w-9 bg-primary opacity-80 aria-[current]:opacity-100 hover:opacity-90 text-primary-foreground"
              >
                <img src={Nhost} className="w-4 h-4" />
                <span className="sr-only">Home</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <NavLink
                to="/profile"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 hover:text-foreground md:h-8 md:w-8 aria-[current]:bg-accent aria-[current]:text-accent-foreground"
              >
                <User className="w-5 h-5" />
                <span className="sr-only">Profile</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Profile</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/protected-notes"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 hover:text-foreground md:h-8 md:w-8"
              >
                <FileLock2 className="w-5 h-5" />
                {/* This is for the most part the most basic feature to require adding an extra verified header */}
                <span className="sr-only">Protected notes</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Secret Notes</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/storage"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
              >
                <Archive className="w-5 h-5" />
                <span className="sr-only">Storage</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Storage</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/apollo"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
              >
                <img
                  className="w-5 h-5"
                  src="https://cdn.worldvectorlogo.com/logos/apollo-graphql-compact.svg"
                />
                <span className="sr-only">Apollo client</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Apollo client</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="#"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
              >
                <CircleHelp className="w-5 h-5" />
                <span className="sr-only">About</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">About</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={'/'}
                onClick={handleSignOut}
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
              >
                <LogOut className="w-5 h-5" />
                <span className="sr-only">Sign out</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </nav>
        <nav className="flex flex-col items-center gap-4 px-2 mt-auto sm:py-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="#"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
              >
                <Settings className="w-5 h-5" />
                <span className="sr-only">Settings</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </nav>
      </aside>
      <div className="flex flex-col items-center sm:gap-4 sm:py-4 sm:pl-14">
        <header className="sticky top-0 z-30 flex items-center w-full gap-4 px-4 border-b h-14 bg-background sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="w-5 h-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
              <nav className="grid gap-6 text-lg font-medium">
                <NavLink
                  to="#"
                  className="flex items-center justify-center w-10 h-10 gap-2 text-lg font-semibold rounded-full group shrink-0 bg-primary text-primary-foreground md:text-base"
                >
                  <Package2 className="w-5 h-5 transition-all group-hover:scale-110" />
                  <span className="sr-only">Acme Inc</span>
                </NavLink>
                <NavLink
                  to="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Home className="w-5 h-5" />
                  Dashboard
                </NavLink>
                <NavLink to="#" className="flex items-center gap-4 px-2.5 text-foreground">
                  <ShoppingCart className="w-5 h-5" />
                  Orders
                </NavLink>
                <NavLink
                  to="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Package className="w-5 h-5" />
                  Products
                </NavLink>
                <NavLink
                  to="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Users2 className="w-5 h-5" />
                  Customers
                </NavLink>
                <NavLink
                  to="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <LineChart className="w-5 h-5" />
                  Settings
                </NavLink>
              </nav>
            </SheetContent>
          </Sheet>

          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                <User />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> */}
        </header>
        {/* <main className="grid items-center flex-1 max-w-6xl gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <Outlet />
        </main> */}
        <main className="flex flex-col items-center justify-center flex-1 w-full max-w-5xl p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
