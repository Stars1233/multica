import { create } from 'zustand'
import { toast } from '@multica/ui/components/ui/sonner'

// Minimum loading time for user perception (ms)
const MIN_LOADING_TIME = 800

// Types matching the IPC response
export type SkillSource = 'bundled' | 'global' | 'profile'

export interface SkillInfo {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  source: SkillSource
  triggers: string[]
}

interface SkillsStore {
  // State
  skills: SkillInfo[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  fetch: () => Promise<void>
  refresh: (options?: { silent?: boolean }) => Promise<void>
  toggleSkill: (skillId: string) => Promise<void>
  setSkillStatus: (skillId: string, enabled: boolean) => Promise<void>
}

export const useSkillsStore = create<SkillsStore>()((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  initialized: false,

  fetch: async () => {
    // Skip if already initialized
    if (get().initialized) return

    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.skills.list()

      if (Array.isArray(result)) {
        set({
          skills: result,
          initialized: true,
        })
      } else {
        set({ error: 'Invalid response from skills:list' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[SkillsStore] Failed to load:', message)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async (options?: { silent?: boolean }) => {
    set({ loading: true, error: null })

    const startTime = Date.now()

    try {
      const result = await window.electronAPI.skills.list()

      // Ensure minimum loading time for user perception
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
      }

      if (Array.isArray(result)) {
        set({ skills: result })
        if (!options?.silent) toast.success('Skills refreshed')
      } else {
        set({ error: 'Invalid response from skills:list' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to refresh skills', { description: message })
      console.error('[SkillsStore] Failed to refresh:', message)
    } finally {
      set({ loading: false })
    }
  },

  toggleSkill: async (skillId: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.skills.toggle(skillId)
      const typedResult = result as { error?: string; enabled?: boolean }

      if (typedResult.error) {
        set({ error: typedResult.error })
        toast.error('Failed to toggle skill', { description: typedResult.error })
        return
      }

      // Find skill name for toast
      const skill = get().skills.find(s => s.id === skillId)
      const skillName = skill?.name ?? skillId

      // Update local state
      set((state) => ({
        skills: state.skills.map((skill) =>
          skill.id === skillId
            ? { ...skill, enabled: typedResult.enabled ?? !skill.enabled }
            : skill
        ),
      }))

      toast.success(`${skillName} ${typedResult.enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to toggle skill', { description: message })
      console.error('[SkillsStore] Failed to toggle:', message)
    }
  },

  setSkillStatus: async (skillId: string, enabled: boolean) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.skills.setStatus(skillId, enabled)
      const typedResult = result as { error?: string }

      if (typedResult.error) {
        set({ error: typedResult.error })
        toast.error('Failed to update skill', { description: typedResult.error })
        return
      }

      // Find skill name for toast
      const skill = get().skills.find(s => s.id === skillId)
      const skillName = skill?.name ?? skillId

      // Update local state
      set((state) => ({
        skills: state.skills.map((skill) =>
          skill.id === skillId ? { ...skill, enabled } : skill
        ),
      }))

      toast.success(`${skillName} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to update skill', { description: message })
      console.error('[SkillsStore] Failed to set status:', message)
    }
  },
}))

// Selector helpers (use with useMemo in components)
export const selectEnabledSkills = (skills: SkillInfo[]) =>
  skills.filter(s => s.enabled)

export const selectSkillStats = (skills: SkillInfo[]) => ({
  total: skills.length,
  enabled: skills.filter(s => s.enabled).length,
  disabled: skills.filter(s => !s.enabled).length,
  bundled: skills.filter(s => s.source === 'bundled').length,
  global: skills.filter(s => s.source === 'global').length,
  profile: skills.filter(s => s.source === 'profile').length,
})
