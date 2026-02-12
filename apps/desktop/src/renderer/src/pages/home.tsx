import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@multica/ui/components/ui/button'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@multica/ui/components/ui/collapsible'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@multica/ui/components/ui/tooltip'
import {
  Loader2,
  ChevronDown,
  Check,
  AlertCircle,
  ArrowRight,
  QrCode,
  Pencil,
  Plug,
  Code,
  Share,
  Clock,
  Brain,
  RefreshCw,
} from 'lucide-react'
import { ConnectionQRCode } from '../components/qr-code'
import { DeviceList } from '../components/device-list'
import { AgentSettingsDialog } from '../components/agent-settings-dialog'
import { ApiKeyDialog } from '../components/api-key-dialog'
import { OAuthDialog } from '../components/oauth-dialog'
import { useHubStore, selectPrimaryAgent } from '../stores/hub'
import { useProviderStore } from '../stores/provider'
import { useChannelsStore } from '../stores/channels'
import { useSkillsStore, selectSkillStats } from '../stores/skills'
import { useToolsStore } from '../stores/tools'
import { useCronJobsStore } from '../stores/cron-jobs'
import { toast } from '@multica/ui/components/ui/sonner'
import { cn } from '@multica/ui/lib/utils'

export default function HomePage() {
  const navigate = useNavigate()
  const { hubInfo, agents, loading } = useHubStore()
  const { providers, current, setProvider, refresh, loading: providerLoading } = useProviderStore()
  const { skills } = useSkillsStore()
  const { tools } = useToolsStore()
  const { states: channelStates } = useChannelsStore()
  const { jobs: cronJobs } = useCronJobsStore()

  // Computed values
  const skillStats = selectSkillStats(skills)

  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)
  const [capabilitiesRefreshing, setCapabilitiesRefreshing] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agentName, setAgentName] = useState<string | undefined>()
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false)
  const [qrCodeExpanded, setQrCodeExpanded] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<{
    id: string
    name: string
    authMethod: 'api-key' | 'oauth'
    loginCommand?: string
  } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Computed stats
  const enabledTools = tools.filter(t => t.enabled).length
  const connectedChannels = channelStates.filter(s => s.status === 'running').length
  const cronCount = cronJobs.length

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

  // Get the first agent
  const primaryAgent = selectPrimaryAgent(agents)

  // Agent status: running if app is open, warning if no LLM provider
  const isProviderAvailable = current?.available ?? false
  const agentReady = !providerLoading && isProviderAvailable

  // Loading state (only while provider info is loading)
  if (loading || providerLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Starting agent...</span>
        </div>
      </div>
    )
  }

  // Refresh all capabilities
  const refreshCapabilities = async () => {
    setCapabilitiesRefreshing(true)
    try {
      await Promise.all([
        useSkillsStore.getState().refresh({ silent: true }),
        useToolsStore.getState().refresh({ silent: true }),
        useChannelsStore.getState().refresh({ silent: true }),
        useCronJobsStore.getState().refresh({ silent: true }),
      ])
      toast.success('Status refreshed')
    } catch (err) {
      // Individual store refresh errors are already toasted
      console.error('[HomePage] Failed to refresh capabilities:', err)
    } finally {
      setCapabilitiesRefreshing(false)
    }
  }

  // Build capability summary
  const capabilitySummary = `${skillStats.enabled} skills, ${enabledTools} tools, ${connectedChannels} channels, ${cronCount} scheduled tasks`

  return (
    <div className="h-full overflow-auto">
    <div className="container flex flex-col p-6 h-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-medium">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your agent's status and capabilities.</p>
      </div>

      {/* Row 1: Status + Chat (Left) | Agent Settings (Right) */}
      <div className="flex gap-8 mb-6">
        {/* Left: Status + Chat */}
        <div className="flex-1">
          {/* Status */}
          <div className="flex items-center gap-2 mb-1 mt-4">
            <span className="relative flex size-2">
              {agentReady ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-yellow-500" />
                </>
              )}
            </span>
            <span className={cn(
              'font-medium',
              agentReady
                ? 'text-green-600 dark:text-green-400'
                : 'text-yellow-600 dark:text-yellow-400'
            )}>
              {agentReady
                ? 'Your agent is running'
                : 'Configure LLM provider to start'}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {agentReady
              ? 'Ready to assist you. Start a conversation to get things done.'
              : 'Select an LLM provider on the right to enable your agent.'}
          </p>

          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => navigate('/chat')}
            disabled={!agentReady}
          >
            Start Chat
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-border" />

        {/* Right: Agent Settings (stacked vertically) */}
        <div className="flex-1 space-y-4">
          {/* Agent Profile */}
          <div>
            <span className="text-sm text-muted-foreground block mb-2">Agent Profile</span>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setSettingsOpen(true)}
            >
              <span>{agentName || 'Unnamed Agent'}</span>
              <Pencil className="size-4 text-muted-foreground" />
            </Button>
          </div>

          {/* LLM Provider */}
          <div className="relative" ref={dropdownRef}>
            <span className="text-sm text-muted-foreground block mb-2">LLM Provider</span>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
              disabled={providerLoading || switching}
            >
              <span className="flex items-center gap-2">
                {current?.available ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <AlertCircle className="size-4 text-yellow-500" />
                )}
                <span>{current?.providerName ?? 'Loading...'}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground text-xs font-mono">{current?.model ?? '-'}</span>
              </span>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  providerDropdownOpen && 'rotate-180'
                )}
              />
            </Button>

            {/* Provider Dropdown */}
            {providerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-popover border border-border rounded-lg shadow-lg p-2 max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-1.5">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors',
                        p.id === current?.provider
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-accent/50 border border-transparent',
                        !p.available && 'opacity-60 hover:opacity-80'
                      )}
                      onClick={async () => {
                        if (!p.available) {
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
                    >
                      <span className={cn(
                        'size-1.5 rounded-full flex-shrink-0',
                        p.available ? 'bg-green-500' : 'bg-muted-foreground/50'
                      )} />
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

                {/* Model List */}
                {(() => {
                  const currentProvider = providers.find(p => p.id === current?.provider)
                  if (!currentProvider || currentProvider.models.length <= 1) return null
                  return (
                    <div className="border-t border-border mt-2 pt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
                        Models
                      </p>
                      <div className="space-y-0.5">
                        {currentProvider.models.map((model) => (
                          <button
                            key={model}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs transition-colors',
                              model === current?.model
                                ? 'bg-primary/10 text-foreground'
                                : 'hover:bg-accent/50 text-muted-foreground'
                            )}
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
                            <span className={cn(
                              'size-1.5 rounded-full flex-shrink-0',
                              model === current?.model ? 'bg-primary' : 'bg-muted-foreground/30'
                            )} />
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
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-6" />

      {/* Section 3: Capabilities (Collapsible) */}
      <Collapsible open={capabilitiesOpen} onOpenChange={setCapabilitiesOpen} className="mb-6">
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-2 text-sm">
            <Brain className="size-4 text-muted-foreground" />
            Your agent currently has {capabilitySummary}
            <Tooltip>
              <TooltipTrigger
                onClick={refreshCapabilities}
                disabled={capabilitiesRefreshing}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {capabilitiesRefreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent>Refresh status</TooltipContent>
            </Tooltip>
          </span>
          <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {capabilitiesOpen ? 'Hide' : 'Details'}
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                capabilitiesOpen && 'rotate-180'
              )}
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-4 space-y-4">
          {/* Skills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plug className="size-4 text-muted-foreground" />
                <span>Skills ({skillStats.enabled})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate('/skills')}
              >
                View all
                <ArrowRight className="size-3" />
              </Button>
            </div>
            {skillStats.enabled > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.filter(s => s.enabled).slice(0, 8).map((skill) => (
                  <span
                    key={skill.id}
                    className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground truncate max-w-[150px]"
                    title={skill.name}
                  >
                    {skill.name}
                  </span>
                ))}
                {skillStats.enabled > 8 && (
                  <span className="text-xs px-2 py-1 text-muted-foreground">
                    +{skillStats.enabled - 8} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No skills enabled</p>
            )}
          </div>

          {/* Tools */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Code className="size-4 text-muted-foreground" />
                <span>Tools ({enabledTools})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate('/tools')}
              >
                View all
                <ArrowRight className="size-3" />
              </Button>
            </div>
            {enabledTools > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tools.filter(t => t.enabled).slice(0, 8).map((tool) => (
                  <span
                    key={tool.name}
                    className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground truncate max-w-[150px]"
                    title={tool.description || tool.name}
                  >
                    {tool.name}
                  </span>
                ))}
                {enabledTools > 8 && (
                  <span className="text-xs px-2 py-1 text-muted-foreground">
                    +{enabledTools - 8} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No tools enabled</p>
            )}
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Share className="size-4 text-muted-foreground" />
                <span>Channels ({connectedChannels})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate('/channels')}
              >
                View all
                <ArrowRight className="size-3" />
              </Button>
            </div>
            {connectedChannels > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {channelStates.filter(s => s.status === 'running').slice(0, 8).map((channel) => (
                  <span
                    key={`${channel.channelId}-${channel.accountId}`}
                    className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground truncate max-w-[150px]"
                  >
                    {channel.channelId}/{channel.accountId}
                  </span>
                ))}
                {connectedChannels > 8 && (
                  <span className="text-xs px-2 py-1 text-muted-foreground">
                    +{connectedChannels - 8} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No channels connected</p>
            )}
          </div>

          {/* Cron Jobs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4 text-muted-foreground" />
                <span>Scheduled Tasks ({cronCount})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate('/crons')}
              >
                View all
                <ArrowRight className="size-3" />
              </Button>
            </div>
            {cronCount > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {cronJobs.slice(0, 8).map((job) => (
                  <span
                    key={job.id}
                    className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground truncate max-w-[150px]"
                    title={job.description || job.name}
                  >
                    {job.name}
                  </span>
                ))}
                {cronCount > 8 && (
                  <span className="text-xs px-2 py-1 text-muted-foreground">
                    +{cronCount - 8} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No scheduled tasks</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Divider */}
      <div className="border-t border-border mb-6" />

      {/* Section 4: Multi-Device Access */}
      <div className="flex-1 min-h-0">
        <div className="flex gap-8 h-full">
          {/* Left: Connect */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Control from Anywhere</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrCodeExpanded(!qrCodeExpanded)}
              >
                <QrCode className="size-4 mr-1.5" />
                {qrCodeExpanded ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pl-0.5">
              Open Multica Web on your phone and scan. Operate your computer and use your agent remotely.
            </p>

            {/* QR Code Container */}
            <div className="flex-1 flex items-center justify-center mt-4">
              {qrCodeExpanded ? (
                <ConnectionQRCode
                  gateway={hubInfo?.url ?? 'http://localhost:3000'}
                  hubId={hubInfo?.hubId ?? 'unknown'}
                  agentId={primaryAgent?.id}
                  expirySeconds={30}
                  size={140}
                />
              ) : (
                <button
                  onClick={() => setQrCodeExpanded(true)}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                >
                  <QrCode className="size-12 text-muted-foreground/40" />
                  <span className="text-sm text-muted-foreground">Click to show QR code</span>
                </button>
              )}
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-px bg-border self-stretch" />

          {/* Right: Authorized Devices */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-medium mb-2">Authorized Devices</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Devices you've approved to access your agent.
            </p>
            <div className="flex-1 overflow-auto">
              <DeviceList />
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AgentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {selectedProvider && selectedProvider.authMethod === 'api-key' && (
        <ApiKeyDialog
          open={apiKeyDialogOpen}
          onOpenChange={setApiKeyDialogOpen}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          onSuccess={async () => {
            await refresh()
            const result = await setProvider(selectedProvider.id)
            if (!result.ok) {
              console.error('Failed to switch provider:', result.error)
            }
          }}
        />
      )}

      {selectedProvider && selectedProvider.authMethod === 'oauth' && (
        <OAuthDialog
          open={oauthDialogOpen}
          onOpenChange={setOauthDialogOpen}
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          loginCommand={selectedProvider.loginCommand}
          onSuccess={async () => {
            await refresh()
            const result = await setProvider(selectedProvider.id)
            if (!result.ok) {
              console.error('Failed to switch provider:', result.error)
            }
          }}
        />
      )}
    </div>
    </div>
  )
}
