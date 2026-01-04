import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  Banknote,
  Vault,
  Award,
  ShieldCheck,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Invoices", href: "/app/invoices", icon: FileText },
  { name: "Financing", href: "/app/financing", icon: Banknote },
  { name: "Funding Pool", href: "/app/vault", icon: Vault },
  { name: "Reputation", href: "/app/reputation", icon: Award },
  { name: "Proofs", href: "/app/proofs", icon: ShieldCheck },
  // { name: "Activity", href: "/app/activity", icon: Activity }, // Hidden for now
  { name: "Settings", href: "/app/settings", icon: Settings },
]

interface SidebarContentProps {
  collapsed?: boolean
  onNavigate?: () => void
}

function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const location = useLocation()

  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-2" onClick={() => onNavigate?.()}>
          {!collapsed ? (
            <span className="text-2xl font-bold tracking-tight text-primary">SETTL.</span>
          ) : (
            <span className="text-2xl font-bold tracking-tight text-primary">S.</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile()

  // Mobile: Render as Sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
          <div className="flex h-full flex-col">
            <SidebarContent onNavigate={() => onOpenChange?.(false)} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Render as fixed sidebar
  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  )
}
