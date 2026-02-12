import { useState, useMemo } from 'react'
import { Switch } from '@multica/ui/components/ui/switch'
import { Button } from '@multica/ui/components/ui/button'
import {
  RotateCw,
  FolderOpen,
  Code,
  Globe,
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  Users,
} from 'lucide-react'
import type { ToolInfo } from '../stores/tools'

// Group display names
const GROUP_NAMES: Record<string, string> = {
  fs: 'File System',
  runtime: 'Runtime',
  web: 'Web',
  memory: 'Memory',
  subagent: 'Subagent',
  cron: 'Cron',
  other: 'Other',
}

// Group icons
const GROUP_ICONS: Record<string, typeof FolderOpen> = {
  fs: FolderOpen,
  runtime: Code,
  web: Globe,
  memory: Brain,
  subagent: Users,
  cron: Clock,
  other: Code,
}

interface ToolListProps {
  tools: ToolInfo[]
  loading: boolean
  error: string | null
  onToggleTool: (toolName: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function ToolList({
  tools,
  loading,
  error,
  onToggleTool,
  onRefresh,
}: ToolListProps) {
  // Compute groups from tools
  const groups = useMemo(() => {
    const groupIds = [...new Set(tools.map(t => t.group))]
    return groupIds.map(id => ({
      id,
      name: GROUP_NAMES[id] || id,
      tools: tools.filter(t => t.group === id),
      enabledCount: tools.filter(t => t.group === id && t.enabled).length,
      totalCount: tools.filter(t => t.group === id).length,
    }))
  }, [tools])

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id))
  )

  // Track toggling state for individual tools
  const [togglingTools, setTogglingTools] = useState<Set<string>>(new Set())

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleToggleTool = async (toolName: string) => {
    setTogglingTools((prev) => new Set(prev).add(toolName))
    try {
      await onToggleTool(toolName)
    } finally {
      setTogglingTools((prev) => {
        const next = new Set(prev)
        next.delete(toolName)
        return next
      })
    }
  }

  if (loading && tools.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading tools...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header: Refresh button */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {tools.filter((t) => t.enabled).length} of {tools.length} tools enabled
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="gap-1.5"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Tool groups */}
      <div className="space-y-2">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const GroupIcon = GROUP_ICONS[group.id] || Code

          return (
            <div
              key={group.id}
              className="border rounded-lg overflow-hidden"
            >
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="size-5 text-muted-foreground" />
                  <span className="font-medium">{group.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.enabledCount}/{group.totalCount} enabled
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {/* Group tools */}
              {isExpanded && (
                <div className="divide-y">
                  {group.tools.map((tool) => {
                    const isToggling = togglingTools.has(tool.name)

                    return (
                      <div
                        key={tool.name}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-medium">
                              {tool.name}
                            </code>
                            {!tool.enabled && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                disabled
                              </span>
                            )}
                          </div>
                          {tool.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {tool.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isToggling && (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={tool.enabled}
                            onCheckedChange={() => handleToggleTool(tool.name)}
                            disabled={isToggling}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Note about persistence */}
      <p className="text-xs text-muted-foreground text-center">
        Changes are saved automatically and apply to the running Agent immediately.
      </p>
    </div>
  )
}

export default ToolList
