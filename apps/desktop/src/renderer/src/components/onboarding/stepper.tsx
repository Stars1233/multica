import { cn } from '@multica/ui/lib/utils'
import { Check } from 'lucide-react'

const steps = [
  { label: 'Privacy' },
  { label: 'Provider' },
  { label: 'Connect' },
  { label: 'Try it' },
]

interface StepperProps {
  currentStep: number // 1-based index
}

export function Stepper({ currentStep }: StepperProps) {
  const currentIndex = currentStep - 1 // Convert to 0-based
  // Progress: 0% at step 0, 50% at step 1, 100% at step 2
  const progress = (currentIndex / (steps.length - 1)) * 100

  return (
    <div className="w-full space-y-3">
      {/* Step labels */}
      <nav className="flex items-center justify-center gap-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={step.label} className="flex items-center gap-3">
              {index > 0 && (
                <span
                  className={cn(
                    'text-xs',
                    isCompleted || isCurrent
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/40'
                  )}
                >
                  ›
                </span>
              )}
              <span
                className={cn(
                  'flex items-center gap-1 text-sm transition-colors',
                  isCurrent && 'text-foreground font-medium',
                  isCompleted && 'text-foreground',
                  !isCurrent && !isCompleted && 'text-muted-foreground/60'
                )}
              >
                {isCompleted && (
                  <Check className="size-3.5 text-foreground" />
                )}
                {step.label}
              </span>
            </div>
          )
        })}
      </nav>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
