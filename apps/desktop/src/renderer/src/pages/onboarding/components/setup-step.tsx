import React, { useState } from 'react'
import { Button } from '@multica/ui/components/ui/button'
import { Separator } from '@multica/ui/components/ui/separator'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@multica/ui/components/ui/hover-card'
import { Link } from '@multica/ui/components/ui/link'
import { ChevronLeft, HelpCircle, Loader2 } from 'lucide-react'
import { cn } from '@multica/ui/lib/utils'
import { useProviderStore } from '../../../stores/provider'
import { ApiKeyDialog } from '../../../components/api-key-dialog'
import { OAuthDialog } from '../../../components/oauth-dialog'
import { StepDots } from './step-dots'
import { useOnboardingStore } from '../../../stores/onboarding'

const SUPPORTED_PROVIDERS = ['kimi-coding', 'claude-code', 'openai-codex', 'openrouter']

interface SetupStepProps {
  onNext: () => void
  onBack: () => void
}

export default function SetupStep({ onNext, onBack }: SetupStepProps) {
  const { providers, current, loading, error, refresh, setProvider } =
    useProviderStore()
  const { setProviderConfigured } = useOnboardingStore()

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderStatus | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const hasActiveProvider = current?.available === true

  const filteredProviders = SUPPORTED_PROVIDERS
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is ProviderStatus => p != null)

  const handleConfigure = (provider: ProviderStatus) => {
    setSelectedProvider(provider)
    if (provider.authMethod === 'oauth') {
      setOauthDialogOpen(true)
    } else {
      setApiKeyDialogOpen(true)
    }
  }

  const handleSelect = async (provider: ProviderStatus) => {
    if (provider.available && !switchingId) {
      setSwitchingId(provider.id)
      await setProvider(provider.id, undefined, { silent: true })
      setSwitchingId(null)
    }
  }

  const handleProviderSuccess = async (modelId?: string) => {
    await refresh()
    if (selectedProvider) {
      await setProvider(selectedProvider.id, modelId)
    }
    setProviderConfigured(true)
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
            Connect a provider
          </h1>
          <p className="text-sm text-muted-foreground">
            Multica needs an LLM provider to work. Add your API key.
          </p>
        </div>

        {/* Provider cards */}
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {loading && filteredProviders.length === 0 ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-muted/30" />
            ))
          ) : (
            filteredProviders.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                isActive={Boolean(current?.available && current.provider === provider.id)}
                isSwitching={switchingId === provider.id}
                onSelect={() => handleSelect(provider)}
                onConfigure={() => handleConfigure(provider)}
              />
            ))
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Trust note */}
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            API keys stay local. Stored in{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              ~/.super-multica/
            </code>{' '}
            and never leave your device.
          </p>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <StepDots />
          <Button size="sm" onClick={onNext} disabled={!hasActiveProvider}>
            Continue
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      {selectedProvider && selectedProvider.authMethod === 'api-key' && (
        <ApiKeyDialog
          open={apiKeyDialogOpen}
          onOpenChange={setApiKeyDialogOpen}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          showModelInput={selectedProvider.id === 'openrouter'}
          onSuccess={handleProviderSuccess}
        />
      )}
      {selectedProvider && selectedProvider.authMethod === 'oauth' && (
        <OAuthDialog
          open={oauthDialogOpen}
          onOpenChange={setOauthDialogOpen}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          loginCommand={selectedProvider.loginCommand}
          onSuccess={handleProviderSuccess}
        />
      )}
    </div>
  )
}

function ProviderRow({
  provider,
  isActive,
  isSwitching,
  onSelect,
  onConfigure,
}: {
  provider: ProviderStatus
  isActive: boolean
  isSwitching: boolean
  onSelect: () => void
  onConfigure: () => void
}) {
  const getTutorialSteps = (): React.ReactNode[] => {
    if (provider.authMethod === 'oauth') {
      return [
        <span key="1">Run: <code className="bg-muted px-1 py-0.5 rounded text-xs">{provider.loginCommand}</code></span>,
        'Complete login in browser',
        'Click Configure → Refresh',
      ]
    }
    return [
      provider.loginUrl ? (
        <span key="1">Go to <Link href={provider.loginUrl}>{new URL(provider.loginUrl).hostname}</Link></span>
      ) : (
        'Go to provider dashboard'
      ),
      'Create a new API key',
      'Click Configure and paste',
    ]
  }

  return (
    <div
      onClick={provider.available ? onSelect : undefined}
      className={cn(
        'flex items-center justify-between px-4 py-3 transition-colors',
        provider.available && 'cursor-pointer hover:bg-accent/50'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Radio indicator */}
        <div
          className={cn(
            'size-4 rounded-full flex items-center justify-center shrink-0 transition-colors',
            isSwitching ? '' : 'border-2',
            isActive ? 'border-primary' : 'border-muted-foreground/40'
          )}
        >
          {isSwitching ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : isActive ? (
            <div className="size-2 rounded-full bg-primary" />
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium">{provider.name}</p>
          <p className="text-xs text-muted-foreground">{provider.defaultModel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Help hover card */}
        <HoverCard>
          <HoverCardTrigger
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="size-4" />
          </HoverCardTrigger>
          <HoverCardContent align="end" side="top" className="w-56">
            <p className="font-medium text-sm mb-2">Setup {provider.name}</p>
            <ol className="space-y-1.5">
              {getTutorialSteps().map((step, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-foreground/50 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </HoverCardContent>
        </HoverCard>

        {/* Configure button */}
        <Button
          size="sm"
          variant="outline"
          className={provider.available ? 'text-green-600 hover:text-green-600 dark:text-green-500 dark:hover:text-green-500' : ''}
          onClick={(e) => {
            e.stopPropagation()
            onConfigure()
          }}
        >
          {provider.available ? 'Configured' : 'Configure'}
        </Button>
      </div>
    </div>
  )
}
