import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  id: number
  name: string
  description?: string
  icon?: React.ElementType
}

interface StepsIndicatorProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function StepsIndicator({ steps, currentStep, className }: StepsIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Mobile view - show only current step with icon */}
      <div className="sm:hidden">
        <nav aria-label="Progress">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {(() => {
                const currentStepData = steps.find(s => s.id === currentStep)
                const Icon = currentStepData?.icon
                
                return (
                  <>
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      currentStep === 4 
                        ? "bg-green-500" 
                        : "border-2 border-primary bg-white"
                    )}>
                      {currentStep === 4 ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : Icon ? (
                        <Icon className="h-5 w-5 text-primary" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Step {currentStep} of {steps.length}
                      </p>
                      <p className="text-sm font-medium">
                        {currentStepData?.name}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex gap-1">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "h-1.5 w-6 rounded-full",
                    step.id < currentStep
                      ? "bg-primary"
                      : step.id === currentStep
                      ? "bg-primary"
                      : "bg-gray-300"
                  )}
                />
              ))}
            </div>
          </div>
        </nav>
      </div>
      
      {/* Desktop view - show all steps */}
      <nav aria-label="Progress" className="hidden sm:block">
        <ol role="list" className="flex items-center">
          {steps.map((step, stepIdx) => (
            <li
              key={step.name}
              className={cn(
                stepIdx !== steps.length - 1 ? "flex-1" : "",
                "relative"
              )}
            >
              {step.id < currentStep ? (
                // Completed step
                <div className="group flex items-center">
                  <span className="flex items-center">
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary group-hover:bg-primary/90">
                      <Check className="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="ml-3 flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-gray-900">{step.name}</span>
                    {step.description && (
                      <span className="text-sm text-gray-500">{step.description}</span>
                    )}
                  </span>
                  {stepIdx !== steps.length - 1 && (
                    <div className="ml-3 flex-1 hidden sm:block" aria-hidden="true">
                      <div className="h-0.5 w-full bg-primary" />
                    </div>
                  )}
                </div>
              ) : step.id === currentStep ? (
                // Current step
                <div className="flex items-center" aria-current="step">
                  <span className="flex items-center">
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="ml-3 flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-primary">{step.name}</span>
                    {step.description && (
                      <span className="text-sm text-gray-500">{step.description}</span>
                    )}
                  </span>
                  {stepIdx !== steps.length - 1 && (
                    <div className="ml-3 flex-1 hidden sm:block" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200" />
                    </div>
                  )}
                </div>
              ) : (
                // Upcoming step
                <div className="group flex items-center">
                  <span className="flex items-center">
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-white group-hover:border-gray-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-transparent" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="ml-3 flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-gray-500">{step.name}</span>
                    {step.description && (
                      <span className="text-sm text-gray-400">{step.description}</span>
                    )}
                  </span>
                  {stepIdx !== steps.length - 1 && (
                    <div className="ml-3 flex-1 hidden sm:block" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200" />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}

// Mobile-optimized version with vertical layout
export function StepsIndicatorMobile({ steps, currentStep, className }: StepsIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      <nav aria-label="Progress">
        <ol role="list" className="space-y-4">
          {steps.map((step) => (
            <li key={step.name}>
              {step.id < currentStep ? (
                // Completed step
                <div className="flex items-center">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                    <Check className="h-4 w-4 text-white" aria-hidden="true" />
                  </span>
                  <span className="ml-3">
                    <span className="text-sm font-medium text-gray-900">{step.name}</span>
                  </span>
                </div>
              ) : step.id === currentStep ? (
                // Current step
                <div className="flex items-center" aria-current="step">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-white">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  </span>
                  <span className="ml-3">
                    <span className="text-sm font-medium text-primary">{step.name}</span>
                  </span>
                </div>
              ) : (
                // Upcoming step
                <div className="flex items-center">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                    <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden="true" />
                  </span>
                  <span className="ml-3">
                    <span className="text-sm font-medium text-gray-500">{step.name}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}