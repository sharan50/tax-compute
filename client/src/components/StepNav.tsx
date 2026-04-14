/**
 * StepNav — Swiss Financial Design
 * 
 * Left sidebar step navigation with oversized numbers.
 * Hairline dividers, teal accent for active step.
 */

import { STEPS, useTaxForm } from "@/contexts/TaxFormContext";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function StepNav() {
  const { state, goToStep } = useTaxForm();
  const { currentStep } = state;

  return (
    <nav className="w-full lg:w-64 shrink-0">
      <div className="lg:sticky lg:top-8">
        <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const isComputation = step.id === "computation";

            return (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-150 whitespace-nowrap lg:whitespace-normal w-full",
                  isActive
                    ? "bg-primary/5 border-l-2 border-primary"
                    : "hover:bg-muted/50 border-l-2 border-transparent",
                  isComputation && !state.computation && "opacity-40 pointer-events-none"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-teal-light text-teal-dark"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : step.number}
                </span>
                <span
                  className={cn(
                    "text-sm transition-colors",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
