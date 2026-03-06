import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const checkboxVariants = cva(
  "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
  {
    variants: {
      size: {
        default: "h-4 w-4",
        sm: "h-3 w-3",
        lg: "h-5 w-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "size"> {
  size?: "default" | "sm" | "lg"
}

function Checkbox({ 
  className, 
  size, 
  checked,
  ...props 
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(checkboxVariants({ size }), className)}
      checked={checked || false}
      {...props}
    />
  )
}

export { Checkbox, checkboxVariants }
