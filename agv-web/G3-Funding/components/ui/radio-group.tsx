import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const radioGroupVariants = cva(
  "grid gap-2",
  {
    variants: {
      orientation: {
        horizontal: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        vertical: "grid-cols-1",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

const radioItemVariants = cva(
  "peer sr-only",
  {}
)

const radioLabelVariants = cva(
  "flex items-center space-x-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground cursor-pointer",
  {}
)

interface RadioGroupProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical"
}

function RadioGroup({ 
  className, 
  orientation,
  children,
  ...props 
}: RadioGroupProps) {
  return (
    <div
      data-slot="radio-group"
      className={cn(radioGroupVariants({ orientation }), className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface RadioItemProps extends React.ComponentProps<"input"> {
  label: string
}

function RadioItem({ 
  className, 
  label,
  id,
  ...props 
}: RadioItemProps) {
  const inputId = id || `radio-${Math.random().toString(36).substr(2, 9)}`
  
  return (
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        id={inputId}
        data-slot="radio-item"
        className={cn(radioItemVariants(), className)}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={cn(radioLabelVariants())}
      >
        {label}
      </label>
    </div>
  )
}

export { RadioGroup, RadioItem, radioGroupVariants, radioItemVariants, radioLabelVariants }
