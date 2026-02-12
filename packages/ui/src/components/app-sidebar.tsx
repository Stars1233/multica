import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@multica/ui/components/ui/sidebar"
import { ThemeToggle } from "@multica/ui/components/theme-toggle"

interface AppSidebarProps {
  children?: React.ReactNode
}

export function AppSidebar({ children }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1">
          <img
            src="/icon.png"
            alt="Multica"
            className="size-7 rounded-md"
          />
          <span className="text-sm tracking-wide font-brand">
            Multica
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>{children}</SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
