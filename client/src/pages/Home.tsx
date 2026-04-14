/**
 * Home Page — Swiss Financial Design
 * 
 * Main layout: left sidebar navigation + right content area.
 * Hero section at top, then the multi-step form.
 * Clean, restrained, data-first.
 */

import { TaxFormProvider, useTaxForm, STEPS } from "@/contexts/TaxFormContext";
import StepNav from "@/components/StepNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react";
import AssesseeStep from "@/components/steps/AssesseeStep";
import SalaryStep from "@/components/steps/SalaryStep";
import HousePropertyStep from "@/components/steps/HousePropertyStep";
import CapitalGainsStep from "@/components/steps/CapitalGainsStep";
import OtherSourcesStep from "@/components/steps/OtherSourcesStep";
import TDSStep from "@/components/steps/TDSStep";
import ComputationStep from "@/components/steps/ComputationStep";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663364015297/YujTc5r47ax4sAczWGvob5/hero-abstract-QQdJWTxp8YhcTXA6BAFXXF.webp";

function StepContent() {
  const { state } = useTaxForm();
  switch (state.currentStep) {
    case 0: return <AssesseeStep />;
    case 1: return <SalaryStep />;
    case 2: return <HousePropertyStep />;
    case 3: return <CapitalGainsStep />;
    case 4: return <OtherSourcesStep />;
    case 5: return <TDSStep />;
    case 6: return <ComputationStep />;
    default: return <AssesseeStep />;
  }
}

function StepNavigation() {
  const { state, nextStep, prevStep, runComputation } = useTaxForm();
  const { currentStep } = state;
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 2; // Before computation
  const isComputation = currentStep === STEPS.length - 1;

  if (isComputation) return null;

  return (
    <div className="flex items-center justify-between pt-8 mt-8 border-t border-border print:hidden">
      <Button
        variant="ghost"
        onClick={prevStep}
        disabled={isFirst}
        className="text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Previous
      </Button>
      
      {isLast ? (
        <Button onClick={runComputation} className="font-display">
          <Calculator className="w-4 h-4 mr-2" />
          Compute Tax
        </Button>
      ) : (
        <Button onClick={nextStep} variant="outline">
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

function TaxFormContent() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-50 print:static print:bg-white">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground font-mono text-xs font-bold">TC</span>
            </div>
            <div>
              <span className="font-display text-sm font-semibold tracking-tight">Tax Compute</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                Indian Income Tax Calculator
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            New Regime · Section 115BAC
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border print:hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container relative py-12 lg:py-16">
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            Income Tax Computation
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xl leading-relaxed">
            Complete end-to-end tax calculation under the New Tax Regime. 
            Enter your income details across all heads and get an instant computation sheet.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container flex-1 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Sidebar Navigation */}
          <StepNav />
          
          {/* Step Content */}
          <div className="flex-1 min-w-0">
            <StepContent />
            <StepNavigation />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 print:hidden">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Tax Compute — For personal use only. Not a substitute for professional tax advice.
            </p>
            <p className="font-mono">
              FY 2024-25 & 2025-26 rates
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <TaxFormProvider>
      <TaxFormContent />
    </TaxFormProvider>
  );
}
