import * as React from "react";
import { cn } from "@/lib/utils";

export interface ValidatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  validationRules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: string) => string | undefined;
  };
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ className, type, label, error, validationRules, onValidationChange, onChange, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | undefined>(error);
    const [hasBeenTouched, setHasBeenTouched] = React.useState(false);

    React.useEffect(() => {
      setLocalError(error);
    }, [error]);

    const validateInput = (value: string): string | undefined => {
      if (!validationRules) return undefined;

      // Required validation
      if (validationRules.required && (!value || value.trim().length === 0)) {
        return "This field is required";
      }

      // Skip other validations if value is empty and not required
      if (!value || value.trim().length === 0) {
        return undefined;
      }

      // Min length validation
      if (validationRules.minLength && value.length < validationRules.minLength) {
        return `Minimum length is ${validationRules.minLength} characters`;
      }

      // Max length validation
      if (validationRules.maxLength && value.length > validationRules.maxLength) {
        return `Maximum length is ${validationRules.maxLength} characters`;
      }

      // Pattern validation
      if (validationRules.pattern && !validationRules.pattern.test(value)) {
        return "Invalid format";
      }

      // Custom validation
      if (validationRules.custom) {
        return validationRules.custom(value);
      }

      return undefined;
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value.length > 0);
      setHasBeenTouched(true);
      
      // Validate on blur
      const validationError = validateInput(e.target.value);
      setLocalError(validationError);
      onValidationChange?.(!validationError, validationError);
      
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setHasValue(value.length > 0);
      
      // Real-time validation if field has been touched
      if (hasBeenTouched) {
        const validationError = validateInput(value);
        setLocalError(validationError);
        onValidationChange?.(!validationError, validationError);
      }
      
      onChange?.(e);
    };

    const isLabelFloating = isFocused || hasValue;
    const displayError = localError;

    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            displayError 
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
            displayError 
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
        {displayError && (
          <p className="mt-1 text-xs text-red-500">{displayError}</p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = "ValidatedInput";

export { ValidatedInput };
