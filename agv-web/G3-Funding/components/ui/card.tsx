import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border",
        elevated: "border-0 shadow-lg",
        flat: "shadow-none border-border",
        interactive: "border-border hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        outlined: "border-2 border-border",
      },
      padding: {
        none: "",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
      spacing: {
        none: "",
        sm: "gap-3",
        default: "gap-6",
        lg: "gap-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
      spacing: "default",
    },
  }
)

function Card({ 
  className, 
  variant, 
  padding, 
  spacing, 
  ...props 
}: React.ComponentProps<"div"> & {
  variant?: "default" | "elevated" | "flat" | "interactive" | "outlined"
  padding?: "none" | "sm" | "default" | "lg"
  spacing?: "none" | "sm" | "default" | "lg"
}) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, padding, spacing }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
