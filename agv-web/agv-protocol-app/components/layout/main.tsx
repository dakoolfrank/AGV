import * as React from "react"
import { cn } from "@/lib/utils"

interface MainProps {
  className?: string
  children?: React.ReactNode
  variant?: "default" | "centered" | "full"
}

export function Main({ 
  className, 
  children, 
  variant = "default" 
}: MainProps) {
  return (
    <main 
      className={cn(
        "flex-1 overflow-auto",
        {
          "container py-8": variant === "default",
          "container flex items-center justify-center py-8": variant === "centered",
          "p-0": variant === "full",
        },
        className
      )}
    >
      {children}
    </main>
  )
}

interface ContentProps {
  className?: string
  children?: React.ReactNode
  variant?: "default" | "centered" | "wide"
}

export function Content({ 
  className, 
  children, 
  variant = "default" 
}: ContentProps) {
  return (
    <div 
      className={cn(
        "mx-auto",
        {
          "max-w-4xl": variant === "default",
          "max-w-2xl": variant === "centered",
          "max-w-7xl": variant === "wide",
        },
        className
      )}
    >
      {children}
    </div>
  )
}

interface SectionProps {
  className?: string
  children?: React.ReactNode
  variant?: "default" | "sm" | "lg"
}

export function Section({ 
  className, 
  children, 
  variant = "default" 
}: SectionProps) {
  return (
    <section 
      className={cn(
        "py-12",
        {
          "py-8": variant === "sm",
          "py-16": variant === "lg",
        },
        className
      )}
    >
      {children}
    </section>
  )
}

interface ContainerProps {
  className?: string
  children?: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "full"
}

export function Container({ 
  className, 
  children, 
  size = "md" 
}: ContainerProps) {
  return (
    <div 
      className={cn(
        "mx-auto px-4 sm:px-6 lg:px-8",
        {
          "max-w-2xl": size === "sm",
          "max-w-4xl": size === "md",
          "max-w-6xl": size === "lg",
          "max-w-7xl": size === "xl",
          "max-w-none": size === "full",
        },
        className
      )}
    >
      {children}
    </div>
  )
}
