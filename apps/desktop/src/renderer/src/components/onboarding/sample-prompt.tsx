import { ArrowRight } from 'lucide-react'

interface SamplePromptProps {
  title: string
  prompt: string
  onClick: () => void
}

export function SamplePrompt({ title, prompt, onClick }: SamplePromptProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group flex items-center justify-between"
    >
      <div className="space-y-0.5 pr-4 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{prompt}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </button>
  )
}
