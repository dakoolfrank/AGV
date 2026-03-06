import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  className?: string
  children?: React.ReactNode
  variant?: "default" | "inset" | "floating"
}

export function Sidebar({ 
  className, 
  children, 
  variant = "default" 
}: SidebarProps) {
  return (
    <aside 
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground",
        {
          "w-64": variant === "default",
          "w-72": variant === "inset",
          "w-80": variant === "floating",
        },
        className
      )}
    >
      {children}
    </aside>
  )
}

interface SidebarHeaderProps {
  className?: string
  children?: React.ReactNode
  title?: string
  actions?: React.ReactNode
}

export function SidebarHeader({ 
  className, 
  children, 
  title, 
  actions 
}: SidebarHeaderProps) {
  return (
    <div className={cn("flex h-16 items-center justify-between border-b px-6", className)}>
      {title && (
        <h2 className="text-lg font-semibold">
          {title}
        </h2>
      )}
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

interface SidebarContentProps {
  className?: string
  children?: React.ReactNode
}

export function SidebarContent({ 
  className, 
  children 
}: SidebarContentProps) {
  return (
    <div className={cn("flex-1 overflow-auto p-6", className)}>
      {children}
    </div>
  )
}

interface SidebarFooterProps {
  className?: string
  children?: React.ReactNode
}

export function SidebarFooter({ 
  className, 
  children 
}: SidebarFooterProps) {
  return (
    <div className={cn("border-t p-6", className)}>
      {children}
    </div>
  )
}

interface SidebarNavProps {
  className?: string
  children?: React.ReactNode
}

export function SidebarNav({ 
  className, 
  children 
}: SidebarNavProps) {
  return (
    <nav className={cn("space-y-2", className)}>
      {children}
    </nav>
  )
}

interface SidebarNavItemProps {
  className?: string
  children?: React.ReactNode
  active?: boolean
  href?: string
  onClick?: () => void
}

export function SidebarNavItem({ 
  className, 
  children, 
  active = false,
  href,
  onClick
}: SidebarNavItemProps) {
  const Component = href ? "a" : "button"
  
  return (
    <Component
      href={href}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        {
          "bg-sidebar-primary text-sidebar-primary-foreground": active,
        },
        className
      )}
    >
      {children}
    </Component>
  )
}
