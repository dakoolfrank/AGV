import * as React from "react";
import { cn } from "@/lib/utils";

export interface DurationInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const DurationInput = React.forwardRef<HTMLInputElement, DurationInputProps>(
  ({ className, label, error, value = "", onChange, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);
    const [durationValue, setDurationValue] = React.useState(value);
    const [durationUnit, setDurationUnit] = React.useState("years");

    React.useEffect(() => {
      setHasValue(durationValue.length > 0);
    }, [durationValue]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Only allow numbers, decimal point, and empty string
      if (inputValue === "" || /^\d*\.?\d*$/.test(inputValue)) {
        setDurationValue(inputValue);
        const fullValue = inputValue ? `${inputValue} ${durationUnit}` : "";
        onChange?.(fullValue);
      }
    };

    const handleUnitChange = (unit: string) => {
      setDurationUnit(unit);
      const fullValue = durationValue ? `${durationValue} ${unit}` : "";
      onChange?.(fullValue);
    };

    const isLabelFloating = isFocused || hasValue;

    return (
      <div className="relative">
        <div className={cn(
          "flex rounded-md border",
          error 
            ? "border-red-500" 
            : "border-white"
        )}>
          <input
            type="text"
            className={cn(
              "flex h-12 w-full rounded-l-md border-r-0 bg-transparent px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              "border-transparent focus-visible:ring-transparent",
              className
            )}
            ref={ref}
            value={durationValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleInputChange}
            placeholder=""
            {...props}
          />
          <select
            value={durationUnit}
            onChange={(e) => handleUnitChange(e.target.value)}
            className={cn(
              "flex h-12 rounded-r-md border-l-0 bg-transparent px-3 py-2 text-sm text-white ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              "border-transparent focus-visible:ring-transparent"
            )}
          >
            <option value="years" className="bg-gray-800 text-white">Years</option>
            <option value="months" className="bg-gray-800 text-white">Months</option>
          </select>
        </div>
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

DurationInput.displayName = "DurationInput";

export { DurationInput };
