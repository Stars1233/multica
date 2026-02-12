import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@multica/ui/components/ui/button'
import {
  MessageSquare,
  Link2,
  Loader2,
  AlertCircle,
  Pencil,
  ChevronDown,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { ConnectionQRCode } from '../components/qr-code'
import { DeviceList } from '../components/device-list'
import { AgentSettingsDialog } from '../components/agent-settings-dialog'
import { ApiKeyDialog } from '../components/api-key-dialog'
import { OAuthDialog } from '../components/oauth-dialog'
import { useHubStore } from '../stores/hub'
import { useProviderStore } from '../stores/provider'

export default function HomePage() {
  const navigate = useNavigate()
  const { hubInfo, agents, loading, error } = useHubStore()
  const { providers, current, setProvider, refresh, loading: providerLoading } = useProviderStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agentName, setAgentName] = useState<string | undefined>()
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<{
    id: string
    name: string
    authMethod: 'api-key' | 'oauth'
    loginCommand?: string
  } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProviderDropdownOpen(false)
      }
    }

    if (providerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [providerDropdownOpen])

  // Load agent profile info
  useEffect(() => {
    loadAgentInfo()
  }, [])

  // Reload agent info when settings dialog closes
  useEffect(() => {
    if (!settingsOpen) {
      loadAgentInfo()
    }
  }, [settingsOpen])

  const loadAgentInfo = async () => {
    try {
      const data = await window.electronAPI.profile.get()
      setAgentName(data.name)
    } catch (err) {
      console.error('Failed to load agent info:', err)
    }
  }

  // Get the first agent (or create one if none exists)
  const primaryAgent = agents[0]

  // Connection state indicator
  // Note: 'registered' means fully connected and registered with Gateway
  const connectionState = hubInfo?.connectionState ?? 'disconnected'
  const isConnected = connectionState === 'connected' || connectionState === 'registered'

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Connecting to Hub...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-destructive">
          <AlertCircle className="size-8" />
          <span className="font-medium">Connection Error</span>
          <span className="text-sm text-muted-foreground">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main content - QR + Status */}
      <div className="flex-1 flex gap-8 p-2">
        {/* Left: QR Code */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <ConnectionQRCode
            gateway={hubInfo?.url ?? 'http://localhost:3000'}
            hubId={hubInfo?.hubId ?? 'unknown'}
            agentId={primaryAgent?.id}
            expirySeconds={30}
            size={180}
          />
        </div>

        {/* Right: Hub Status */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="space-y-6">
            {/* Hub Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex size-2.5">
                  {isConnected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
                    </>
                  ) : connectionState === 'connecting' || connectionState === 'reconnecting' ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2.5 bg-yellow-500" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full size-2.5 bg-red-500" />
                  )}
                </span>
                <span className={`text-sm font-medium ${
                  isConnected
                    ? 'text-green-600 dark:text-green-400'
                    : connectionState === 'connecting' || connectionState === 'reconnecting'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {isConnected
                    ? 'Hub Connected'
                    : connectionState === 'connecting'
                    ? 'Connecting...'
                    : connectionState === 'reconnecting'
                    ? 'Reconnecting...'
                    : 'Disconnected'}
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Local Hub
              </h2>
              <p className="text-sm text-muted-foreground font-mono">
                {hubInfo?.hubId ?? 'Initializing...'}
              </p>
            </div>

            {/* Agent Settings */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Agent Settings
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
              <p className="font-medium">{agentName || 'Unnamed Agent'}</p>
            </div>

            {/* Provider Selector */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50 relative" ref={dropdownRef}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                LLM Provider
              </p>
              <button
                className="w-full flex items-center justify-between p-3 rounded-md bg-background border border-border hover:bg-accent/50 transition-colors disabled:opacity-50"
                onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
                disabled={providerLoading || switching}
              >
                <div className="flex items-center gap-2">
                  {current?.available ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="size-4 text-yellow-500" />
                  )}
                  <div className="text-left">
                    <p className="font-medium text-sm">{current?.providerName ?? current?.provider ?? 'Loading...'}</p>
                    <p className="text-xs text-muted-foreground">{current?.model ?? '-'}</p>
                  </div>
                </div>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${providerDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Provider Dropdown - Compact Grid + Model List */}
              {providerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-background border border-border rounded-md shadow-lg p-2 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-3 gap-1.5">
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                          p.id === current?.provider
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-accent/50 border border-transparent'
                        } ${!p.available ? 'opacity-60 hover:opacity-80' : ''}`}
                        onClick={async () => {
                          if (!p.available) {
                            // Show config dialog for unavailable providers
                            setSelectedProvider({
                              id: p.id,
                              name: p.name,
                              authMethod: p.authMethod,
                              loginCommand: p.loginCommand,
                            })
                            setProviderDropdownOpen(false)
                            if (p.authMethod === 'oauth') {
                              setOauthDialogOpen(true)
                            } else {
                              setApiKeyDialogOpen(true)
                            }
                            return
                          }
                          setSwitching(true)
                          setProviderDropdownOpen(false)
                          const result = await setProvider(p.id)
                          setSwitching(false)
                          if (!result.ok) {
                            console.error('Failed to switch provider:', result.error)
                          }
                        }}
                        disabled={switching}
                        title={`${p.name}\n${p.authMethod === 'oauth' ? 'OAuth' : 'API Key'} · ${p.defaultModel}`}
                      >
                        <span className={`size-1.5 rounded-full flex-shrink-0 ${
                          p.available ? 'bg-green-500' : 'bg-muted-foreground/50'
                        }`} />
                        <span className="truncate font-medium">
                          {p.id === 'claude-code' ? 'Claude Code' :
                           p.id === 'openai-codex' ? 'Codex' :
                           p.id === 'kimi-coding' ? 'Kimi' :
                           p.id === 'anthropic' ? 'Anthropic' :
                           p.id === 'openai' ? 'OpenAI' :
                           p.id === 'openrouter' ? 'OpenRouter' :
                           p.name.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Model List for current provider */}
                  {(() => {
                    const currentProvider = providers.find(p => p.id === current?.provider)
                    if (!currentProvider || currentProvider.models.length <= 1) return null
                    return (
                      <div className="border-t border-border mt-2 pt-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
                          Models — {currentProvider.name}
                        </p>
                        <div className="space-y-0.5">
                          {currentProvider.models.map((model) => (
                            <button
                              key={model}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs transition-colors ${
                                model === current?.model
                                  ? 'bg-primary/10 text-foreground'
                                  : 'hover:bg-accent/50 text-muted-foreground'
                              }`}
                              onClick={async () => {
                                if (model === current?.model) return
                                setSwitching(true)
                                setProviderDropdownOpen(false)
                                const result = await setProvider(currentProvider.id, model)
                                setSwitching(false)
                                if (!result.ok) {
                                  console.error('Failed to switch model:', result.error)
                                }
                              }}
                              disabled={switching}
                            >
                              <span className={`size-1.5 rounded-full flex-shrink-0 ${
                                model === current?.model ? 'bg-primary' : 'bg-muted-foreground/30'
                              }`} />
                              <span className="font-mono truncate">{model}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Gateway
                </p>
                <p className="font-medium text-sm truncate" title={hubInfo?.url}>
                  {hubInfo?.url ?? '-'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Connection
                </p>
                <p className="font-medium capitalize">{connectionState}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Devices */}
      <div className="px-4 pb-2">
        <DeviceList />
      </div>

      {/* Agent Settings Dialog */}
      <AgentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* API Key Dialog */}
      {selectedProvider && selectedProvider.authMethod === 'api-key' && (
        <ApiKeyDialog
          open={apiKeyDialogOpen}
          onOpenChange={setApiKeyDialogOpen}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          onSuccess={async () => {
            // Refresh provider list and switch to the newly configured provider
            await refresh()
            const result = await setProvider(selectedProvider.id)
            if (!result.ok) {
              console.error('Failed to switch provider:', result.error)
            }
          }}
        />
      )}

      {/* OAuth Dialog */}
      {selectedProvider && selectedProvider.authMethod === 'oauth' && (
        <OAuthDialog
          open={oauthDialogOpen}
          onOpenChange={setOauthDialogOpen}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          loginCommand={selectedProvider.loginCommand}
          onSuccess={async () => {
            // Refresh provider list and switch to the newly configured provider
            await refresh()
            const result = await setProvider(selectedProvider.id)
            if (!result.ok) {
              console.error('Failed to switch provider:', result.error)
            }
          }}
        />
      )}

      {/* Bottom: Actions */}
      <div className="border-t p-4">
        <div className="flex items-center justify-between">
          {/* Primary Action: Chat */}
          <Button
            size="lg"
            className="gap-2 px-6"
            onClick={() => navigate('/chat')}
            disabled={!isConnected}
          >
            <MessageSquare className="size-5" />
            Open Chat
          </Button>

          {/* Secondary: Connect to Remote */}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
          >
            <Link2 className="size-4" />
            Connect to Remote Agent
          </Button>
        </div>
      </div>
    </div>
  )
}
