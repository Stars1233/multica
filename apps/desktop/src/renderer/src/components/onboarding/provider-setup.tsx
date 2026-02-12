import { Button } from '@multica/ui/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@multica/ui/lib/utils'

interface ProviderSetupProps {
  providers: ProviderStatus[]
  loading: boolean
  activeProviderId?: string
  onConfigure: (provider: ProviderStatus) => void
  onSelect: (provider: ProviderStatus) => void
  onFocus?: (provider: ProviderStatus) => void
}

const SUPPORTED_PROVIDERS = ['kimi-coding', 'claude-code', 'openai-codex', 'openrouter']

function ProviderCard({
  provider,
  isActive,
  onConfigure,
  onSelect,
  onFocus,
}: {
  provider: ProviderStatus
  isActive: boolean
  onConfigure: (p: ProviderStatus) => void
  onSelect: (p: ProviderStatus) => void
  onFocus?: (p: ProviderStatus) => void
}) {
  return (
    <div
      onClick={() => provider.available && onSelect(provider)}
      onMouseEnter={() => onFocus?.(provider)}
      className={cn(
        'flex items-center justify-between p-4 rounded-xl border bg-card transition-colors',
        provider.available && 'cursor-pointer hover:bg-accent/30',
        isActive
          ? 'border-primary ring-1 ring-primary/20'
          : provider.available
            ? 'border-primary/30'
            : 'border-border'
      )}
    >
      <div className="flex items-center gap-3">
        {provider.available ? (
          <div
            className={cn(
              'size-4 rounded-full border-2 shrink-0 flex items-center justify-center',
              isActive ? 'border-primary' : 'border-muted-foreground/30'
            )}
          >
            {isActive && <div className="size-2 rounded-full bg-primary" />}
          </div>
        ) : (
          <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
        )}
        <div>
          <p className="font-medium text-sm">{provider.name}</p>
          <p className="text-xs text-muted-foreground">
            {provider.defaultModel}
          </p>
        </div>
      </div>

      {provider.available ? (
        <div className="flex items-center gap-2">
          <Check className="size-4 text-primary" />
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground h-auto py-1 px-2"
            onClick={(e) => {
              e.stopPropagation()
              onConfigure(provider)
            }}
          >
            Reconfigure
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            onConfigure(provider)
          }}
        >
          Configure
        </Button>
      )}
    </div>
  )
}

export function ProviderSetup({
  providers,
  loading,
  activeProviderId,
  onConfigure,
  onSelect,
  onFocus,
}: ProviderSetupProps) {
  const filtered = SUPPORTED_PROVIDERS
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is ProviderStatus => p != null)

  if (loading && filtered.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl border border-border bg-card animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {filtered.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          isActive={activeProviderId === provider.id}
          onConfigure={onConfigure}
          onSelect={onSelect}
          onFocus={onFocus}
        />
      ))}
    </div>
  )
}
