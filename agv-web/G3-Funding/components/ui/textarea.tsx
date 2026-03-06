import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      size: {
        default: "min-h-[80px]",
        sm: "min-h-[60px] text-xs",
        lg: "min-h-[120px] text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface TextareaProps extends Omit<React.ComponentProps<"textarea">, "size"> {
  size?: "default" | "sm" | "lg"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ 
  className, 
  size, 
  ...props 
}, ref) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ size }), className)}
      ref={ref}
      {...props}
    />
  )
})

Textarea.displayName = "Textarea"

export { Textarea, textareaVariants }
