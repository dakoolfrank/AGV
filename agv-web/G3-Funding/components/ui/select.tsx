import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const selectVariants = cva(
  "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      size: {
        default: "h-10",
        sm: "h-8 px-2 text-xs",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface SelectProps extends Omit<React.ComponentProps<"select">, "size"> {
  size?: "default" | "sm" | "lg"
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ 
  className, 
  size, 
  children,
  ...props 
}, ref) => {
  return (
    <select
      data-slot="select"
      className={cn(selectVariants({ size }), className)}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
})

Select.displayName = "Select"

export { Select, selectVariants }
