import * as React from "react";
import { cn } from "@/lib/utils";

export interface FloatingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value.length > 0);
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0);
      props.onChange?.(e);
    };

    const isLabelFloating = isFocused || hasValue;

    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error 
              ? "border-red-500 focus-visible:ring-red-500" 
              : "border-white focus-visible:ring-white",
            className
          )}
          ref={ref}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...props}
        />
        <label
          className={cn(
            "absolute left-3 transition-all duration-200 ease-in-out pointer-events-none",
            isLabelFloating
              ? "-top-2 text-xs bg-white px-1"
              : "top-3 text-sm",
            error 
              ? isLabelFloating 
                ? "text-red-500" 
                : "text-red-300"
              : isLabelFloating 
                ? "text-black/70" 
                : "text-white/70"
          )}
        >
          {label}
        </label>
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
