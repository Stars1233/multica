import { Button } from '@multica/ui/components/ui/button'
import { MulticaIcon } from '@multica/ui/components/multica-icon'

const features = [
  {
    title: 'Your AI',
    description: 'Choose your preferred model. Extend its abilities with Skills.',
  },
  {
    title: 'Your Machine',
    description: 'Runs locally on your computer. Your data stays with you.',
  },
  {
    title: 'Your Control',
    description: 'You set the boundaries. The AI works within them.',
  },
]

interface WelcomeStepProps {
  onStart: () => void
}

export default function WelcomeStep({ onStart }: WelcomeStepProps) {
  return (
    <div className="h-full flex items-center justify-center px-12 py-8 animate-in fade-in duration-300">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        {/* Brand Title */}
        <div className="flex items-center gap-2.5">
          <MulticaIcon animate className="size-4 text-muted-foreground/70" />
          <h1 className="text-2xl tracking-wide font-brand">
            Welcome to Multica
          </h1>
        </div>

        {/* Intro */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          An AI assistant that gets things done — pulling data, running analysis,
          and taking action. Talk to it like a team member.
        </p>

        {/* Feature List */}
        <div className="w-full bg-muted/50 rounded-2xl p-5 space-y-4 text-left">
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wider">
            Built on three principles
          </p>
          {features.map((feature) => (
            <div key={feature.title} className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">
                {feature.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Button size="lg" onClick={onStart} className="px-8">
          Start Exploring
        </Button>
      </div>
    </div>
  )
}
