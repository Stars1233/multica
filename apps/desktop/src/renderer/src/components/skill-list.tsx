import { useState } from 'react'
import { Button } from '@multica/ui/components/ui/button'
import { Badge } from '@multica/ui/components/ui/badge'
import { Switch } from '@multica/ui/components/ui/switch'
import {
  RotateCw,
  Loader2,
  CheckCircle,
  X,
} from 'lucide-react'
import type { SkillInfo, SkillSource } from '../stores/skills'

// Source badge colors
const SOURCE_COLORS: Record<SkillSource, string> = {
  bundled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  global: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  profile: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

// Source section titles
const SOURCE_TITLES: Record<SkillSource, string> = {
  bundled: 'Built-in Skills',
  global: 'Global Skills',
  profile: 'Profile Skills',
}

interface SkillListProps {
  skills: SkillInfo[]
  loading: boolean
  error: string | null
  onToggleSkill: (skillId: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function SkillList({
  skills,
  loading,
  error,
  onToggleSkill,
  onRefresh,
}: SkillListProps) {
  // Track toggling state for individual skills
  const [togglingSkills, setTogglingSkills] = useState<Set<string>>(new Set())

  const handleToggleSkill = async (skillId: string) => {
    setTogglingSkills((prev) => new Set(prev).add(skillId))
    try {
      await onToggleSkill(skillId)
    } finally {
      setTogglingSkills((prev) => {
        const next = new Set(prev)
        next.delete(skillId)
        return next
      })
    }
  }

  // Group skills by source
  const skillsBySource: Record<SkillSource, SkillInfo[]> = {
    bundled: skills.filter((s) => s.source === 'bundled'),
    global: skills.filter((s) => s.source === 'global'),
    profile: skills.filter((s) => s.source === 'profile'),
  }

  // Order of sources to display
  const sourceOrder: SkillSource[] = ['bundled', 'global', 'profile']

  if (loading && skills.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading skills...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {skills.filter((s) => s.enabled).length} of {skills.length} skills enabled
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-1.5"
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

      {/* Skills grouped by source */}
      {sourceOrder.map((source) => {
        const sourceSkills = skillsBySource[source]
        if (sourceSkills.length === 0) return null

        return (
          <div key={source} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  source === 'bundled'
                    ? 'bg-blue-500'
                    : source === 'global'
                    ? 'bg-green-500'
                    : 'bg-purple-500'
                }`}
              />
              {SOURCE_TITLES[source]}
              <span className="text-xs">({sourceSkills.length})</span>
            </h3>
            <div className="space-y-1">
              {sourceSkills.map((skill) => {
                const isToggling = togglingSkills.has(skill.id)

                return (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    {/* Left: Name + Description */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{skill.name}</span>
                        <code className="text-xs text-muted-foreground font-mono">
                          /{skill.id}
                        </code>
                        <Badge variant="secondary" className={`text-xs ${SOURCE_COLORS[skill.source]}`}>
                          {skill.source}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {skill.description}
                      </p>
                      {skill.triggers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.triggers.slice(0, 3).map((trigger) => (
                            <code
                              key={trigger}
                              className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >
                              {trigger}
                            </code>
                          ))}
                          {skill.triggers.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{skill.triggers.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Center: Status */}
                    <div className="flex items-center gap-2 px-4">
                      <div
                        className={`flex items-center gap-1 ${
                          skill.enabled
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {skill.enabled ? (
                          <CheckCircle className="size-4" />
                        ) : (
                          <X className="size-4" />
                        )}
                        <span className="text-xs font-medium">
                          {skill.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Toggle */}
                    <div className="flex items-center gap-2">
                      {isToggling && (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )}
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={() => handleToggleSkill(skill.id)}
                        disabled={isToggling}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {skills.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No skills found.</p>
        </div>
      )}

      {/* Note about persistence */}
      <p className="text-xs text-muted-foreground text-center">
        Changes are saved automatically. Restart Agent session to apply skill changes.
      </p>
    </div>
  )
}

export default SkillList
