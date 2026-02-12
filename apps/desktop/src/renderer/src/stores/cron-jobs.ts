import { create } from 'zustand'
import { toast } from '@multica/ui/components/ui/sonner'

// Minimum loading time for user perception (ms)
const MIN_LOADING_TIME = 800

// Types matching the IPC response
export interface CronJobInfo {
  id: string
  name: string
  description?: string
  enabled: boolean
  schedule: string
  sessionTarget: string
  nextRunAt: string | null
  lastStatus: 'ok' | 'error' | 'skipped' | null
  lastRunAt: string | null
  lastDurationMs: number | null
  lastError: string | null
}

interface CronJobsStore {
  // State
  jobs: CronJobInfo[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  fetch: () => Promise<void>
  refresh: (options?: { silent?: boolean }) => Promise<void>
  toggleJob: (jobId: string) => Promise<void>
  removeJob: (jobId: string) => Promise<void>
}

export const useCronJobsStore = create<CronJobsStore>()((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  initialized: false,

  fetch: async () => {
    // Skip if already initialized
    if (get().initialized) return

    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.cron.list()

      if (Array.isArray(result)) {
        set({
          jobs: result as CronJobInfo[],
          initialized: true,
        })
      } else {
        set({ error: 'Invalid response from cron:list' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[CronJobsStore] Failed to load:', message)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async (options?: { silent?: boolean }) => {
    set({ loading: true, error: null })

    const startTime = Date.now()

    try {
      const result = await window.electronAPI.cron.list()

      // Ensure minimum loading time for user perception
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
      }

      if (Array.isArray(result)) {
        set({ jobs: result as CronJobInfo[] })
        if (!options?.silent) toast.success('Tasks refreshed')
      } else {
        set({ error: 'Invalid response from cron:list' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to refresh tasks', { description: message })
      console.error('[CronJobsStore] Failed to refresh:', message)
    } finally {
      set({ loading: false })
    }
  },

  toggleJob: async (jobId: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.cron.toggle(jobId)
      const typedResult = result as { error?: string; id?: string; enabled?: boolean }

      if (typedResult.error) {
        set({ error: typedResult.error })
        toast.error('Failed to toggle task', { description: typedResult.error })
        return
      }

      // Find job name for toast
      const job = get().jobs.find(j => j.id === jobId)
      const jobName = job?.name ?? jobId

      // Update local state
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId
            ? { ...job, enabled: typedResult.enabled ?? !job.enabled }
            : job
        ),
      }))

      toast.success(`${jobName} ${typedResult.enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to toggle task', { description: message })
      console.error('[CronJobsStore] Failed to toggle:', message)
    }
  },

  removeJob: async (jobId: string) => {
    set({ error: null })

    try {
      // Find job name before removing
      const job = get().jobs.find(j => j.id === jobId)
      const jobName = job?.name ?? jobId

      const result = await window.electronAPI.cron.remove(jobId)
      const typedResult = result as { error?: string; ok?: boolean }

      if (typedResult.error) {
        set({ error: typedResult.error })
        toast.error('Failed to remove task', { description: typedResult.error })
        return
      }

      // Update local state
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== jobId),
      }))

      toast.success(`${jobName} removed`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to remove task', { description: message })
      console.error('[CronJobsStore] Failed to remove:', message)
    }
  },
}))
