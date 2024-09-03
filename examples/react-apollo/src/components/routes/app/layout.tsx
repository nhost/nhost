import { useElevateSecurityKeyEmail, useSignOut, useUserEmail } from '@nhost/react'
import { Archive, FileLock2, LogOut, PanelLeft, Settings, SquareCheckBig, User } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Nhost from '@/assets/nhost.svg'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function Layout() {
  const { signOut } = useSignOut()
  const [showMobileNav, setShowMobileNav] = useState(false)
  const navigate = useNavigate()
  const userEmail = useUserEmail()

  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()

  const handleElevate = async () => {
    if (userEmail) {
      const { elevated, isError } = await elevateEmailSecurityKey(userEmail)

      if (elevated) {
        toast.success('You now have an elevated permission')
      }

      if (isError) {
        toast.error('Could not elevate permission')
      }
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

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
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8 aria-[current]:bg-accent aria-[current]:text-accent-foreground"
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
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8 aria-[current]:bg-accent aria-[current]:text-accent-foreground"
              >
                <FileLock2 className="w-5 h-5" />
                <span className="sr-only">Protected notes</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Protected Notes</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/storage"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8 aria-[current]:bg-accent aria-[current]:text-accent-foreground"
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
                to="/todos"
                className="flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground md:h-8 md:w-8 aria-[current]:bg-accent aria-[current]:text-accent-foreground"
              >
                <SquareCheckBig className="w-5 h-5" />
                <span className="sr-only">Todos</span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Todos</TooltipContent>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right">
              <DropdownMenuLabel>
                {userEmail} (elevated: {String(elevated)})
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleElevate}>Elevate permissions</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </aside>
      <div className="flex flex-col items-center sm:gap-4 sm:py-4 sm:pl-14">
        <header className="sticky top-0 z-30 flex items-center w-full gap-4 px-4 border-b h-14 bg-background sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet open={showMobileNav} onOpenChange={(open) => setShowMobileNav(open)}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="w-5 h-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
              <nav className="flex flex-col gap-4 text-lg font-medium">
                <NavLink
                  to="/"
                  onClick={() => setShowMobileNav(false)}
                  className="flex items-center justify-center rounded-full h-9 w-9 bg-primary opacity-80 aria-[current]:opacity-100 hover:opacity-90 text-primary-foreground"
                >
                  <img src={Nhost} className="w-4 h-4" />
                  <span className="sr-only">Home</span>
                </NavLink>

                <NavLink
                  to="/profile"
                  onClick={() => setShowMobileNav(false)}
                  className="flex items-center gap-4 p-2 rounded-md aria-[current]:bg-accent aria-[current]:text-accent-foreground text-muted-foreground"
                >
                  <User className="w-5 h-5" />
                  Profile
                </NavLink>

                <NavLink
                  to="/protected-notes"
                  onClick={() => setShowMobileNav(false)}
                  className="flex items-center gap-4 p-2 rounded-md aria-[current]:bg-accent aria-[current]:text-accent-foreground text-muted-foreground"
                >
                  <FileLock2 className="w-5 h-5" />
                  Protected notes
                </NavLink>

                <NavLink
                  to="/storage"
                  onClick={() => setShowMobileNav(false)}
                  className="flex items-center gap-4 p-2 rounded-md aria-[current]:bg-accent aria-[current]:text-accent-foreground text-muted-foreground"
                >
                  <Archive className="w-5 h-5" />
                  Storage
                </NavLink>

                <NavLink
                  to="/todos"
                  onClick={() => setShowMobileNav(false)}
                  className="flex items-center gap-4 p-2 rounded-md aria-[current]:bg-accent aria-[current]:text-accent-foreground text-muted-foreground"
                >
                  <SquareCheckBig className="w-5 h-5" />
                  Todos
                </NavLink>
              </nav>
              <div className="absolute flex flex-col items-center gap-4 px-2 mt-auto bottom-10 sm:py-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                      <Settings className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right">
                    <DropdownMenuLabel>
                      {userEmail} (elevated: {String(elevated)})
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleElevate}>
                      Elevate permissions
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex flex-col items-center justify-center flex-1 w-full max-w-5xl p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
