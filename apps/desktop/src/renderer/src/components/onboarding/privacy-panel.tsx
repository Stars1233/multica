import { Key, Database, Terminal } from 'lucide-react'

const privacyItems = [
  {
    icon: Database,
    title: 'Everything stays local',
    description:
      'All sessions, history, and profiles are stored on your device. Nothing leaves your computer.',
  },
  {
    icon: Key,
    title: 'Your data, your control',
    description:
      'API keys and credentials are saved locally in ~/.super-multica/. We never access them.',
  },
  {
    icon: Terminal,
    title: 'Transparent execution',
    description:
      'Every shell command the agent wants to run requires your explicit approval first.',
  },
]

export function PrivacyPanel() {
  return (
    <div className="rounded-2xl bg-muted/50 border border-border/50 p-6 space-y-5">
      {privacyItems.map((item) => (
        <div key={item.title} className="flex gap-3">
          <div className="mt-0.5 flex items-center justify-center size-7 rounded-lg bg-primary/10 shrink-0">
            <item.icon className="size-4 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="font-medium text-sm text-primary">{item.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
