import { useState } from 'react'
import { Button } from '@multica/ui/components/ui/button'
import { Input } from '@multica/ui/components/ui/input'
import { Badge } from '@multica/ui/components/ui/badge'
import { Separator } from '@multica/ui/components/ui/separator'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@multica/ui/components/ui/hover-card'
import {
  ChevronLeft,
  Loader2,
  HelpCircle,
  Share2,
  Check,
  Info,
} from 'lucide-react'
import { useChannelsStore } from '../../../stores/channels'
import { StepDots } from './step-dots'

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running':
      return 'default'
    case 'starting':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'outline'
  }
}

interface ConnectStepProps {
  onNext: () => void
  onBack: () => void
}

export default function ConnectStep({ onNext, onBack }: ConnectStepProps) {
  const { states, config, saveToken } = useChannelsStore()

  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const state = states.find(
    (s) => s.channelId === 'telegram' && s.accountId === 'default'
  )
  const savedConfig = config['telegram']?.['default'] as
    | { botToken?: string }
    | undefined
  const hasToken = Boolean(savedConfig?.botToken)
  const isRunning = state?.status === 'running'
  const isStarting = state?.status === 'starting'

  const handleConnect = async () => {
    if (!token.trim()) return
    setSaving(true)
    setLocalError(null)
    const result = await saveToken('telegram', 'default', token.trim())
    if (!result.ok) {
      setLocalError(result.error ?? 'Failed to connect')
    } else {
      setToken('')
    }
    setSaving(false)
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
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Connect a channel
          </h1>
          <p className="text-sm text-muted-foreground">
            Create bots that talk to your local agent from anywhere.
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Your bot connects directly to this machine —
            chat from your phone, tablet, or any device.
          </p>
          <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0" />
            Telegram now. Discord, Slack, Mobile app coming soon.
          </p>
        </div>

        {/* Telegram card */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                <Share2 className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-xs text-muted-foreground">
                  Bot API long polling
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status badge */}
              {state && (
                <Badge variant={statusVariant(state.status)}>
                  {state.status}
                </Badge>
              )}

              {/* Help hover card */}
              <HoverCard>
                <HoverCardTrigger className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="size-4" />
                </HoverCardTrigger>
                <HoverCardContent align="end" side="top" className="w-56">
                  <p className="font-medium text-sm mb-2">
                    Get a bot token
                  </p>
                  <ol className="space-y-1.5">
                    <li className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-foreground/50 shrink-0">1.</span>
                      <span>Open @BotFather in Telegram</span>
                    </li>
                    <li className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-foreground/50 shrink-0">2.</span>
                      <span>Send /newbot and name your bot</span>
                    </li>
                    <li className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-foreground/50 shrink-0">3.</span>
                      <span>Copy the token and paste below</span>
                    </li>
                  </ol>
                </HoverCardContent>
              </HoverCard>
            </div>
          </div>

          <div className="p-4">
            {hasToken ? (
              <div className="flex items-center gap-2">
                <Check className="size-4 text-green-600 dark:text-green-500 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {isRunning
                    ? 'Bot is running. Send it a message to test.'
                    : isStarting
                      ? 'Starting bot...'
                      : 'Bot configured.'}
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Bot token from @BotFather"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant='ghost'
                  onClick={handleConnect}
                  disabled={saving || !token.trim()}
                >
                  {saving && (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  )}
                  Connect
                </Button>
              </div>
            )}

            {localError && (
              <p className="text-sm text-destructive mt-2">{localError}</p>
            )}
            {state?.status === 'error' && state.error && (
              <p className="text-sm text-destructive mt-2">{state.error}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <StepDots />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onNext}>
              Skip
            </Button>
            <Button size="sm" onClick={onNext} disabled={!hasToken}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
