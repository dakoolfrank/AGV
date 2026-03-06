import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  className?: string
  children?: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
}

export function Header({ 
  className, 
  children, 
  title, 
  description, 
  actions 
}: HeaderProps) {
  return (
    <header className={cn("border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex flex-col gap-1">
          {title && (
            <h1 className="text-lg font-semibold tracking-tight">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {children}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

interface PageHeaderProps {
  className?: string
  children?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ 
  className, 
  children, 
  title, 
  description, 
  actions 
}: PageHeaderProps) {
  return (
    <div className={cn("border-b bg-background", className)}>
      <div className="container py-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground">
                {description}
              </p>
            )}
            {children}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
