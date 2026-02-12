import { useNavigate } from 'react-router-dom'
import { Button } from '@multica/ui/components/ui/button'
import { Separator } from '@multica/ui/components/ui/separator'
import {
  ChevronLeft,
  ArrowRight,
  Search,
  FolderOpen,
  Terminal,
} from 'lucide-react'
import { StepDots } from './step-dots'

const tryPrompts = [
  {
    icon: Search,
    title: 'Search the web',
    description: "Get today's AI news",
    prompt: "Search the web for today's top AI news and give me a 3-bullet summary with sources.",
  },
  {
    icon: FolderOpen,
    title: 'Read your files',
    description: 'Summarize this directory',
    prompt: 'Look at the files in my current directory and give me a brief summary of what this project is about.',
  },
  {
    icon: Terminal,
    title: 'Run a command',
    description: 'Show system info',
    prompt: 'Write a one-liner shell command that shows my system info (OS, CPU cores, memory) and run it.',
  },
]

interface TryItStepProps {
  onComplete: () => void | Promise<void>
  onBack: () => void
}

export default function TryItStep({ onComplete, onBack }: TryItStepProps) {
  const navigate = useNavigate()

  const handlePromptClick = async (prompt: string) => {
    console.log('[TryItStep] Selected prompt:', prompt)
    await onComplete()
    navigate(`/chat?prompt=${encodeURIComponent(prompt)}`)
  }

  return (
    <div className="h-full flex items-center justify-center px-6 py-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            🎉 Ready to go
          </h1>
          <p className="text-sm text-muted-foreground">
            Your agent is ready. Try a sample task or dive right in.
          </p>
        </div>

        {/* Try prompts */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            ✨ Quick start
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {tryPrompts.map((item) => (
              <button
                key={item.title}
                onClick={() => handlePromptClick(item.prompt)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                    <item.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <StepDots />
          <Button size="sm" onClick={onComplete}>
            Go to Multica
          </Button>
        </div>
      </div>
    </div>
  )
}
