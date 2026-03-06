import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      size: {
        default: "h-10",
        sm: "h-8 px-2 text-xs",
        lg: "h-12 px-4 text-base",
      },
      variant: {
        default: "border-input",
        ghost: "border-transparent bg-transparent shadow-none",
        filled: "border-transparent bg-muted",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  size?: "default" | "sm" | "lg"
  variant?: "default" | "ghost" | "filled"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ 
  className, 
  type, 
  size, 
  variant, 
  ...props 
}, ref) => {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size, variant }), className)}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = "Input"

export { Input, inputVariants }
