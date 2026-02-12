import { cn } from "@multica/ui/lib/utils"
import { useOnboardingStore } from "../../../stores/onboarding"

const TOTAL_STEPS = 4

export function StepDots() {
  const currentStep = useOnboardingStore((s) => s.currentStep)

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1 // steps are 1-based (1, 2, 3, 4)
        const isActive = step === currentStep
        const isCompleted = step < currentStep

        return (
          <div
            key={step}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              isActive && "bg-foreground",
              isCompleted && "bg-foreground/50",
              !isActive && !isCompleted && "bg-muted-foreground/30"
            )}
          />
        )
      })}
    </div>
  )
}
