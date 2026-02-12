import { Switch } from '@multica/ui/components/ui/switch'
import type { LucideIcon } from 'lucide-react'

interface AcknowledgementItemProps {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function AcknowledgementItem({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: AcknowledgementItemProps) {
  return (
    <label className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card cursor-pointer hover:bg-accent/30 transition-colors">
      <div className="mt-0.5 flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-0.5">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-1 shrink-0"
      />
    </label>
  )
}
