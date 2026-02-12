import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@multica/ui/components/ui/button'
import { MulticaIcon } from '@multica/ui/components/multica-icon'
import {
  Home,
  MessageSquare,
  Puzzle,
  Wrench,
  Radio,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@multica/ui/components/ui/sidebar'
import { cn } from '@multica/ui/lib/utils'
import { ModeToggle } from '../components/mode-toggle'
import { DeviceConfirmDialog } from '../components/device-confirm-dialog'
import { UpdateNotification } from '../components/update-notification'

const mainNavItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
]

const configNavItems = [
  { path: '/skills', label: 'Skills', icon: Puzzle },
  { path: '/tools', label: 'Tools', icon: Wrench },
  { path: '/channels', label: 'Channels', icon: Radio },
  { path: '/crons', label: 'Crons', icon: Clock },
]

// All nav items for header lookup
const allNavItems = [...mainNavItems, ...configNavItems]

function NavigationButtons() {
  const navigate = useNavigate()
  // useLocation() triggers re-render on route change so we can re-evaluate history state
  useLocation()

  const historyIdx = window.history.state?.idx ?? 0
  const canGoBack = historyIdx > 0
  const canGoForward = historyIdx < window.history.length - 1

  return (
    <div
      className="flex items-center gap-0.5 ml-auto mr-2"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => navigate(-1)}
        disabled={!canGoBack}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => navigate(1)}
        disabled={!canGoForward}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

function MainHeader() {
  const { state, isMobile } = useSidebar()
  const location = useLocation()
  const needsTrafficLightSpace = state === 'collapsed' || isMobile

  // Find current page info
  const currentPage = allNavItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  )

  return (
    <header className="h-12 shrink-0 flex items-center px-4">
      {/* Drag placeholder for traffic lights when sidebar is collapsed */}
      <div
        className={cn(
          'h-full shrink-0 transition-[width] duration-200 ease-linear',
          needsTrafficLightSpace ? 'w-16' : 'w-0'
        )}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <SidebarTrigger />

      {/* Center: Current page */}
      <div className="flex-1 flex justify-center">
        {currentPage && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <currentPage.icon className="size-4" />
            <span>{currentPage.label}</span>
          </div>
        )}
      </div>

      {/* Right: Theme toggle */}
      <ModeToggle />
    </header>
  )
}

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <SidebarProvider className="flex-1 overflow-hidden">
        <Sidebar>
        {/* Traffic light area with navigation */}
        <SidebarHeader
          className="h-12 shrink-0 flex items-center"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <NavigationButtons />
        </SidebarHeader>

        <SidebarContent>
          {/* Brand */}
          <div className="flex items-center gap-2 px-3 py-2">
            <MulticaIcon bordered noSpin />
            <span className="text-sm font-brand">Multica</span>
          </div>

          {/* Main navigation */}
          <SidebarGroup>
            <SidebarMenu className="space-y-0.5">
              {mainNavItems.map((item) => {
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
                return (
                  <SidebarMenuItem key={item.path}>
                    <NavLink to={item.path}>
                      <SidebarMenuButton isActive={isActive}>
                        <item.icon
                          className={cn(
                            'size-4 transition-colors',
                            !isActive && 'text-muted-foreground/50 group-hover/menu-button:text-foreground'
                          )}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </NavLink>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

          {/* Configuration */}
          <SidebarGroup>
            <SidebarGroupLabel>Agent Configuration</SidebarGroupLabel>
            <SidebarMenu className="space-y-0.5">
              {configNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <SidebarMenuItem key={item.path}>
                    <NavLink to={item.path}>
                      <SidebarMenuButton isActive={isActive}>
                        <item.icon
                          className={cn(
                            'size-4 transition-colors',
                            !isActive && 'text-muted-foreground/50 group-hover/menu-button:text-foreground'
                          )}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </NavLink>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="overflow-hidden">
        <MainHeader />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden min-h-1">
          <Outlet />
        </main>
      </SidebarInset>

        <DeviceConfirmDialog />
        <UpdateNotification />
      </SidebarProvider>
    </div>
  )
}
