import { useState } from 'react'
import { Button } from '@multica/ui/components/ui/button'
import { Checkbox } from '@multica/ui/components/ui/checkbox'
import { Separator } from '@multica/ui/components/ui/separator'
import {
  FolderOpen,
  Terminal,
  Brain,
  Database,
} from 'lucide-react'
import { StepDots } from './step-dots'

const capabilities = [
  {
    icon: FolderOpen,
    title: 'File access',
    description: 'Read & write files to complete tasks you assign',
  },
  {
    icon: Terminal,
    title: 'Shell commands',
    description: 'Run commands — every one requires your approval',
  },
  {
    icon: Brain,
    title: 'LLM requests',
    description: 'Send prompts using your API key directly',
  },
  {
    icon: Database,
    title: 'Local storage',
    description: 'Sessions & credentials saved in ~/.super-multica/',
  },
]

interface PermissionsStepProps {
  onNext: () => void
}

export default function PermissionsStep({ onNext }: PermissionsStepProps) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="h-full flex items-center justify-center px-6 py-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Privacy & trust
          </h1>
          <p className="text-sm text-muted-foreground">
            Multica works locally on your machine. Here's what it can do.
          </p>
        </div>

        {/* Capabilities card */}
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {capabilities.map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-4">
              <div className="mt-0.5 flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust note */}
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Everything stays on your machine. We have no servers and can't see your data.
          </p>
        </div>

        <Separator />

        {/* Footer: dots on left, checkbox + button on right */}
        <div className="flex items-center justify-between pt-4">
          <StepDots />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              I understand
            </label>
            <Button size="sm" onClick={onNext} disabled={!agreed}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
