/**
 * CurrencyInput — Swiss Financial Design
 * 
 * Bottom-border-only input for INR amounts.
 * Right-aligned, monospace, tabular-nums.
 * Formats with Indian number system on blur.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { formatINR } from "@/lib/taxEngine";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  negative?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  label,
  hint,
  disabled = false,
  className,
  negative = false,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setDisplayValue(value ? formatINR(negative ? -value : value) : "");
    }
  }, [value, focused, negative]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setDisplayValue(value ? String(value) : "");
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseInt(displayValue.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      onChange(0);
    }
  }, [displayValue, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setDisplayValue(raw);
  }, []);

  return (
    <div className={cn("group", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm text-muted-foreground leading-relaxed shrink-0">
          {label}
        </label>
        {hint && (
          <span className="text-xs text-muted-foreground/60 shrink-0">{hint}</span>
        )}
      </div>
      <div className="relative mt-1">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 font-mono">
          {negative ? "(-) ₹" : "₹"}
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={focused ? displayValue : (value ? formatINR(value) : "")}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="0"
          className={cn(
            "swiss-input pl-8",
            negative && "text-destructive",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      </div>
    </div>
  );
}
